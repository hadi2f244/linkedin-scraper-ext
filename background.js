// Background service worker for LinkedIn Job Scraper Extension

// Open side panel when user clicks the extension icon
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Listen for tab updates to automatically open side panel on LinkedIn jobs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const url = new URL(tab.url);
    // Auto-open side panel when navigating to LinkedIn jobs
    if (url.hostname.includes('linkedin.com') && url.pathname.startsWith('/jobs')) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {
        // Side panel might already be open, ignore error
      });
    }
  }
});

// IndexedDB helper functions for background script
const openDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('VisaSponsorDB', 2); // Increment version to 2
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // Version 1: Original stores
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('companies')) {
          db.createObjectStore('companies', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      }

      // Version 2: Add job cache and tracking stores
      if (oldVersion < 2) {
        // Job cache store: stores scan results for each job
        if (!db.objectStoreNames.contains('jobCache')) {
          const jobCacheStore = db.createObjectStore('jobCache', { keyPath: 'jobId' });
          jobCacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Job tracking store: tracks viewed and applied jobs
        if (!db.objectStoreNames.contains('jobTracking')) {
          const jobTrackingStore = db.createObjectStore('jobTracking', { keyPath: 'jobId' });
          jobTrackingStore.createIndex('viewedAt', 'viewedAt', { unique: false });
          jobTrackingStore.createIndex('appliedAt', 'appliedAt', { unique: false });
        }
      }
    };
  });
};

const normalizeCompanyName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s&]/g, '')
    .trim();
};

const extractCoreCompanyName = (name) => {
  if (!name) return '';
  let core = normalizeCompanyName(name);
  const suffixes = [
    'limited', 'ltd', 'plc', 'llc', 'inc', 'incorporated',
    'corporation', 'corp', 'company', 'co', 'group', 'holdings',
    'international', 'intl', 'uk', 'usa', 'us', 'europe', 'global'
  ];
  for (const suffix of suffixes) {
    const regex = new RegExp(`\\s+${suffix}$`, 'gi');
    core = core.replace(regex, '').trim();
  }
  return core;
};

// Calculate Levenshtein distance for fuzzy string matching
const levenshteinDistance = (str1, str2) => {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
};

// Calculate fuzzy match confidence score (0-100)
const calculateFuzzyMatchScore = (searchName, csvName) => {
  if (!searchName || !csvName) return 0;

  const n1 = normalizeCompanyName(searchName);
  const n2 = normalizeCompanyName(csvName);

  if (!n1 || !n2) return 0;

  // 1. Exact match after normalization = 100
  if (n1 === n2) return 100;

  const core1 = extractCoreCompanyName(searchName);
  const core2 = extractCoreCompanyName(csvName);

  // 2. Exact core match = 100 (treat as exact match)
  if (core1 === core2 && core1.length > 0) return 100;

  // 3. One is substring of the other (after normalization)
  // STRICTER: Only match if the shorter name is at least 70% of the longer name
  if (n1.includes(n2) || n2.includes(n1)) {
    const longer = n1.length > n2.length ? n1 : n2;
    const shorter = n1.length > n2.length ? n2 : n1;
    const ratio = shorter.length / longer.length;

    // Only match if shorter is at least 70% of longer
    if (ratio >= 0.7) {
      return Math.floor(85 + (ratio * 10)); // 85-95
    }
  }

  // 4. Core name substring match
  // STRICTER: Only match if the shorter core is at least 80% of the longer core
  if (core1.includes(core2) || core2.includes(core1)) {
    const longer = core1.length > core2.length ? core1 : core2;
    const shorter = core1.length > core2.length ? core2 : core1;
    const ratio = shorter.length / longer.length;

    // Only match if shorter is at least 80% of longer
    if (ratio >= 0.8) {
      return Math.floor(75 + (ratio * 10)); // 75-85
    }
  }

  // 5. Word-based matching - MUCH STRICTER
  const words1 = core1.split(/\s+/).filter(w => w.length > 2);
  const words2 = core2.split(/\s+/).filter(w => w.length > 2);

  if (words1.length > 0 && words2.length > 0) {
    let matchingWords = 0;
    for (const w1 of words1) {
      for (const w2 of words2) {
        // STRICTER: Only exact word matches, no substring matching
        if (w1 === w2) {
          matchingWords++;
          break;
        }
      }
    }
    const wordMatchRatio = matchingWords / Math.max(words1.length, words2.length);

    // STRICTER: Require at least 80% word match (was 50%)
    if (wordMatchRatio >= 0.8) {
      return Math.floor(60 + (wordMatchRatio * 20)); // 60-80
    }
  }

  // 6. Levenshtein distance for typo tolerance - STRICTER
  const maxLen = Math.max(core1.length, core2.length);
  if (maxLen > 0) {
    const distance = levenshteinDistance(core1, core2);
    const similarity = 1 - (distance / maxLen);

    // STRICTER: Require 85% similarity (was 70%)
    if (similarity >= 0.85) {
      return Math.floor(similarity * 70); // Up to 70 for high similarity
    }
  }

  // 7. Acronym matching - REMOVED (too prone to false positives)
  // Example: "IT" would match "Information Technology" but also many other companies

  return 0; // No match
};

// Legacy function for backward compatibility - now uses fuzzy scoring
const companyNamesMatch = (searchName, csvName) => {
  const score = calculateFuzzyMatchScore(searchName, csvName);
  return score >= 85; // STRICTER: Increased threshold from 60 to 85
};

const searchCompaniesInIndexedDB = async (companyName) => {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['companies'], 'readonly');
      const store = transaction.objectStore('companies');
      const request = store.getAll();

      request.onsuccess = () => {
        const allCompanies = request.result;
        const matches = [];

        console.log(`[Background] Searching ${allCompanies.length} companies for: "${companyName}"`);

        for (const row of allCompanies) {
          const orgName = row['Organisation Name'] || '';

          // Use the new fuzzy matching score
          const score = calculateFuzzyMatchScore(companyName, orgName);

          // Only include matches with score >= 85 (stricter threshold to reduce false positives)
          if (score >= 85) {
            matches.push({
              ...row,
              matchScore: score,
              confidence: score // Add confidence field for display
            });
          }
        }

        console.log(`[Background] Found ${matches.length} matches with score >= 85`);

        // Sort by score (highest first)
        matches.sort((a, b) => b.matchScore - a.matchScore);

        // Return top 10 matches (increased from 5 for better fuzzy results)
        const topMatches = matches.slice(0, 10);

        if (topMatches.length > 0) {
          console.log(`[Background] Top match: "${topMatches[0]['Organisation Name']}" (score: ${topMatches[0].matchScore})`);
        }

        db.close();
        resolve(topMatches);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Background] Error searching IndexedDB:', error);
    return [];
  }
};

// Job Cache Functions
const getJobCache = async (jobId) => {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['jobCache'], 'readonly');
      const store = transaction.objectStore('jobCache');
      const request = store.get(jobId);

      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Background] Error getting job cache:', error);
    return null;
  }
};

const setJobCache = async (jobId, cacheData) => {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['jobCache'], 'readwrite');
      const store = transaction.objectStore('jobCache');

      const data = {
        jobId,
        timestamp: Date.now(),
        ...cacheData
      };

      const request = store.put(data);

      request.onsuccess = () => {
        db.close();
        resolve(true);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Background] Error setting job cache:', error);
    return false;
  }
};

const clearExpiredCache = async (maxAgeMs = 7 * 24 * 60 * 60 * 1000) => {
  try {
    const db = await openDatabase();
    const now = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['jobCache'], 'readwrite');
      const store = transaction.objectStore('jobCache');
      const index = store.index('timestamp');
      const request = index.openCursor();

      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (now - cursor.value.timestamp > maxAgeMs) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          db.close();
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Background] Error clearing expired cache:', error);
    return 0;
  }
};

// Job Tracking Functions
const getJobTracking = async (jobId) => {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['jobTracking'], 'readonly');
      const store = transaction.objectStore('jobTracking');
      const request = store.get(jobId);

      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Background] Error getting job tracking:', error);
    return null;
  }
};

const setJobTracking = async (jobId, trackingData) => {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['jobTracking'], 'readwrite');
      const store = transaction.objectStore('jobTracking');

      const data = {
        jobId,
        ...trackingData
      };

      const request = store.put(data);

      request.onsuccess = () => {
        db.close();
        resolve(true);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Background] Error setting job tracking:', error);
    return false;
  }
};

const getAllTrackedJobs = async () => {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['jobTracking'], 'readonly');
      const store = transaction.objectStore('jobTracking');
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        resolve(request.result || []);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Background] Error getting all tracked jobs:', error);
    return [];
  }
};

const clearAllTracking = async () => {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['jobTracking'], 'readwrite');
      const store = transaction.objectStore('jobTracking');
      const request = store.clear();

      request.onsuccess = () => {
        db.close();
        resolve(true);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Background] Error clearing tracking:', error);
    return false;
  }
};

// Clear all job caches (for debugging/testing)
const clearAllJobCaches = async () => {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['jobCache'], 'readwrite');
      const store = transaction.objectStore('jobCache');
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[Background] ✓ Cleared all job caches');
        db.close();
        resolve(true);
      };

      request.onerror = () => {
        console.error('[Background] Error clearing all caches:', request.error);
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Background] Error clearing all caches:', error);
    return false;
  }
};

// Clear expired cache on startup
clearExpiredCache().then(count => {
  if (count > 0) {
    console.log(`[Background] Cleared ${count} expired job cache entries`);
  }
});

// Company research function
async function researchCompany(companyName, jobDescription) {
  console.log('[Background] Starting company research for:', companyName);

  const sources = [];
  let description = '';

  try {
    // 1. Extract "About the Company" from job description
    const aboutCompanyMatch = jobDescription.match(/About\s+(?:the\s+)?Company[:\s]+([\s\S]*?)(?=\n\n|$)/i);
    if (aboutCompanyMatch && aboutCompanyMatch[1]) {
      const aboutText = aboutCompanyMatch[1].trim();
      if (aboutText.length > 50) {
        description += `**About the Company (from job posting):**\n${aboutText}\n\n`;
        sources.push('Job Description');
        console.log('[Background] Extracted "About the Company" section:', aboutText.substring(0, 100));
      }
    }

    // 2. Try to get LinkedIn company page description
    // Note: This would require navigating to the company page or using LinkedIn API
    // For now, we'll extract what we can from the job description

    // Extract company information from job description
    const companyInfoPatterns = [
      /About\s+us[:\s]+([\s\S]*?)(?=\n\n|$)/i,
      /Who\s+we\s+are[:\s]+([\s\S]*?)(?=\n\n|$)/i,
      /Company\s+overview[:\s]+([\s\S]*?)(?=\n\n|$)/i,
      /Our\s+company[:\s]+([\s\S]*?)(?=\n\n|$)/i
    ];

    for (const pattern of companyInfoPatterns) {
      const match = jobDescription.match(pattern);
      if (match && match[1]) {
        const text = match[1].trim();
        if (text.length > 50 && !description.includes(text)) {
          description += `**Company Information:**\n${text}\n\n`;
          if (!sources.includes('Job Description')) {
            sources.push('Job Description');
          }
          console.log('[Background] Extracted company info:', text.substring(0, 100));
          break;
        }
      }
    }

    // If no description found, provide a basic message
    if (!description) {
      description = `Company: ${companyName}\n\nNo detailed company information was found in the job description. You may want to visit the company's LinkedIn page or website for more information.`;
      sources.push('Basic Info');
    }

    return {
      description: description.trim(),
      sources: sources
    };

  } catch (error) {
    console.error('[Background] Error in researchCompany:', error);
    throw new Error(`Failed to research company: ${error.message}`);
  }
}

// Listen for messages from content script and forward to side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'JOB_DATA_UPDATED') {
    // Store the job data in chrome.storage so the side panel can retrieve it
    console.log('[Background] Job data updated, storing in chrome.storage');
    chrome.storage.local.set({
      LAST_JOB_DATA: message.data,
      LAST_JOB_DATA_TIMESTAMP: Date.now()
    }).then(() => {
      console.log('[Background] Job data stored successfully');
    }).catch(err => {
      console.error('[Background] Failed to store job data:', err);
    });
  } else if (message.type === 'SEARCH_VISA_SPONSOR') {
    // Handle visa sponsorship search from content script
    console.log('[Background] Searching for company:', message.companyName);
    searchCompaniesInIndexedDB(message.companyName)
      .then(matches => {
        console.log('[Background] Found matches:', matches.length);
        sendResponse({ success: true, matches });
      })
      .catch(error => {
        console.error('[Background] Search error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  } else if (message.type === 'GET_JOB_CACHE') {
    getJobCache(message.jobId)
      .then(cache => {
        sendResponse({ success: true, cache });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else if (message.type === 'SET_JOB_CACHE') {
    setJobCache(message.jobId, message.cacheData)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else if (message.type === 'GET_JOB_TRACKING') {
    getJobTracking(message.jobId)
      .then(tracking => {
        sendResponse({ success: true, tracking });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else if (message.type === 'SET_JOB_TRACKING') {
    setJobTracking(message.jobId, message.trackingData)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else if (message.type === 'GET_ALL_TRACKED_JOBS') {
    getAllTrackedJobs()
      .then(jobs => {
        sendResponse({ success: true, jobs });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else if (message.type === 'CLEAR_ALL_TRACKING') {
    clearAllTracking()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else if (message.type === 'CLEAR_ALL_JOB_CACHES') {
    clearAllJobCaches()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else if (message.type === 'RESEARCH_COMPANY') {
    // Handle company research request
    console.log('[Background] Researching company:', message.companyName);
    researchCompany(message.companyName, message.jobDescription)
      .then(result => {
        console.log('[Background] Company research completed');
        sendResponse({ success: true, description: result.description, sources: result.sources });
      })
      .catch(error => {
        console.error('[Background] Company research error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  return true;
});

