/**
 * LinkedIn Job Scraper Extension - Background Service Worker
 *
 * This service worker handles:
 *
 * 1. Side Panel Management:
 *    - Auto-opens side panel when browsing LinkedIn jobs
 *    - Handles extension icon clicks
 *
 * 2. Message Routing:
 *    - Routes messages between content script and side panel
 *    - Handles RESEARCH_COMPANY requests
 *    - Manages tab-based content extraction
 *
 * 3. Company Research:
 *    - Extracts content from LinkedIn company pages
 *    - Extracts content from company websites
 *    - Extracts content from custom URLs
 *    - Implements intelligent 10-step text extraction
 *    - Manages 24-hour cache with TTL
 *
 * 4. AI Integration:
 *    - Supports OpenAI, GitHub Copilot, Groq, Hugging Face
 *    - Handles AI-powered company research summarization
 *    - Variable replacement in prompts
 *    - Error handling for AI provider failures
 *
 * 5. Tab Management:
 *    - Opens URLs in background tabs for content extraction
 *    - Injects scripts to extract page content
 *    - Closes tabs after extraction
 *    - Handles anti-bot protection with manual fallback
 *
 * @version 1.0.0
 * @author LinkedIn Job Scraper Extension
 */

// Import CopilotAuth for GitHub Copilot support
importScripts('copilot-auth.js');
const copilotAuth = new CopilotAuth();

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

// Helper function to extract text content from HTML
function extractTextFromHTML(html, maxLength = 1000) {
  // Step 1: Remove HTML comments first
  let text = html.replace(/<!--[\s\S]*?-->/g, '');

  // Step 2: Try to extract main content area first (prioritize meaningful content)
  let mainContent = '';

  // Try to find main content in order of priority
  const contentSelectors = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*(?:class|id)="[^"]*(?:content|main|about|description)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*(?:class|id)="[^"]*(?:about|content|description)[^"]*"[^>]*>([\s\S]*?)<\/section>/i
  ];

  for (const selector of contentSelectors) {
    const match = text.match(selector);
    if (match && match[1] && match[1].length > 200) {
      mainContent = match[1];
      console.log('[extractTextFromHTML] Found main content using selector');
      break;
    }
  }

  // If we found main content, use it; otherwise use full HTML
  if (mainContent) {
    text = mainContent;
  }

  // Step 3: Remove unwanted elements and their content
  // Remove script, style, noscript tags
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

  // Remove nav, header, footer, aside tags
  text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');
  text = text.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');
  text = text.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');
  text = text.replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');

  // Remove elements with navigation/menu classes or IDs
  text = text.replace(/<[^>]+(?:class|id)="[^"]*(?:nav|menu|header|footer|sidebar|cookie|banner|breadcrumb)[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi, '');

  // Remove button elements (usually navigation)
  text = text.replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, '');

  // Step 4: Convert block elements to line breaks BEFORE removing tags
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/section>/gi, '\n\n');
  text = text.replace(/<\/article>/gi, '\n\n');

  // Step 5: Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Step 6: Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');

  // Step 7: Clean up whitespace
  text = text.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs to single space
  text = text.replace(/\n\s*\n\s*\n+/g, '\n\n'); // Multiple newlines to double newline
  text = text.replace(/^\s+/gm, ''); // Remove leading whitespace from each line
  text = text.trim();

  // Step 8: Remove lines that are likely navigation (short lines with no punctuation)
  const lines = text.split('\n');
  const meaningfulLines = lines.filter(line => {
    const trimmed = line.trim();
    // Keep lines that are:
    // - Longer than 40 characters, OR
    // - Contain sentence-ending punctuation, OR
    // - Are empty (for paragraph breaks)
    return trimmed.length === 0 ||
           trimmed.length > 40 ||
           /[.!?]/.test(trimmed);
  });
  text = meaningfulLines.join('\n');

  // Step 9: Clean up again after filtering
  text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
  text = text.trim();

  // Step 10: Truncate to max length at sentence boundary if possible
  if (text.length > maxLength) {
    text = text.substring(0, maxLength);
    const lastPeriod = text.lastIndexOf('.');
    const lastNewline = text.lastIndexOf('\n');
    const cutPoint = Math.max(lastPeriod, lastNewline);
    if (cutPoint > maxLength * 0.8) {
      text = text.substring(0, cutPoint + 1);
    }
    text = text.trim() + '...';
  }

  return text;
}

// Helper function to fetch and extract content from a URL
async function fetchUrlContent(url, maxLength = 1000, timeout = 30000) {
  console.log('[Background] Fetching URL:', url);
  console.log('[Background] Timeout set to:', timeout, 'ms');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const text = extractTextFromHTML(html, maxLength);

    if (!text || text.trim().length === 0) {
      throw new Error('No meaningful content extracted from page. The website may require JavaScript or have anti-bot protection.');
    }

    return text;

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout/1000} seconds. The website may be slow or blocking automated requests. Try opening the page in your browser first.`);
    }
    throw error;
  }
}

// Helper function to scrape LinkedIn company page
async function scrapeLinkedInCompanyPage(companyUrl, maxLength = 1000) {
  console.log('[Background] Scraping LinkedIn company page:', companyUrl);
  console.log('[Background] ⚠️ Note: LinkedIn scraping requires authentication. Results may be limited for unauthenticated requests.');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(companyUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    let description = '';

    // Method 1: Look for company description meta tags (most reliable for unauthenticated)
    const metaDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
    if (metaDescMatch && metaDescMatch[1]) {
      description = metaDescMatch[1].trim();
      console.log('[Background] ✓ Extracted from og:description meta tag');
    }

    // Method 2: Look for description in JSON-LD structured data
    if (!description || description.length < 100) {
      const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1]);
          if (jsonData.description) {
            description = jsonData.description;
            console.log('[Background] ✓ Extracted from JSON-LD');
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    }

    // Method 3: Look for title tag as fallback
    if (!description || description.length < 50) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        const title = titleMatch[1].replace(/\s*\|\s*LinkedIn\s*$/i, '').trim();
        if (title.length > 20) {
          description = `Company: ${title}`;
          console.log('[Background] ⚠️ Using title tag as fallback (limited info available)');
        }
      }
    }

    // Clean up and validate
    description = description.trim();

    // If we got JSON data instead of text, it means LinkedIn returned the SPA shell
    if (description.includes('{"data":') || description.includes('"entityUrn"')) {
      throw new Error('LinkedIn returned JSON data - authentication required for full content. Please visit the LinkedIn company page directly in your browser to see full details.');
    }

    if (description.length < 30) {
      throw new Error('Could not extract meaningful content from LinkedIn page. LinkedIn may require authentication to view company details.');
    }

    // Truncate if needed
    if (description.length > maxLength) {
      description = description.substring(0, maxLength);
      const lastPeriod = description.lastIndexOf('.');
      if (lastPeriod > maxLength * 0.8) {
        description = description.substring(0, lastPeriod + 1);
      }
      description = description.trim() + '...';
    }

    return description;

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout after 30 seconds. LinkedIn may be blocking automated requests.');
    }
    console.error('[Background] Error scraping LinkedIn page:', error);
    throw error;
  }
}

// Helper function to find company website URL
function findCompanyWebsiteUrl(jobDescription, linkedinContent) {
  console.log('[Background] Looking for company website URL');

  // Common patterns for website URLs in job descriptions
  const urlPatterns = [
    /(?:Visit us at|Learn more at|Website:|www\.|https?:\/\/)((?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi,
    /(?:company website|our website|visit our site)[:\s]+([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/gi
  ];

  const urls = [];

  // Search in job description
  for (const pattern of urlPatterns) {
    const matches = jobDescription.matchAll(pattern);
    for (const match of matches) {
      let url = match[1];
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
      // Filter out LinkedIn URLs
      if (!url.includes('linkedin.com')) {
        urls.push(url);
      }
    }
  }

  // Search in LinkedIn content if available
  if (linkedinContent) {
    for (const pattern of urlPatterns) {
      const matches = linkedinContent.matchAll(pattern);
      for (const match of matches) {
        let url = match[1];
        if (!url.startsWith('http')) {
          url = 'https://' + url;
        }
        if (!url.includes('linkedin.com')) {
          urls.push(url);
        }
      }
    }
  }

  // Return the first unique URL found
  const uniqueUrls = [...new Set(urls)];
  return uniqueUrls.length > 0 ? uniqueUrls[0] : null;
}

// Helper function to open URL in new tab and extract content
async function fetchContentFromNewTab(url, maxLength = 1000) {
  console.log('[Background] Opening URL in new tab:', url);

  return new Promise(async (resolve, reject) => {
    try {
      // Create a new tab
      const tab = await chrome.tabs.create({ url: url, active: false });
      console.log('[Background] Tab created with ID:', tab.id);

      // Set a timeout for the entire operation
      const timeoutId = setTimeout(() => {
        chrome.tabs.remove(tab.id).catch(() => {});
        reject(new Error('Timeout waiting for page to load'));
      }, 30000); // 30 second timeout

      // Listen for tab updates
      const updateListener = async (tabId, changeInfo, updatedTab) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          console.log('[Background] Tab loaded, extracting content...');

          try {
            // Inject content script to extract text
            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (maxLen) => {
                // Extract text from the page
                const bodyText = document.body.innerText || '';

                // Try to get meta description
                const metaDesc = document.querySelector('meta[property="og:description"]')?.content ||
                               document.querySelector('meta[name="description"]')?.content ||
                               '';

                // Combine and limit
                let content = metaDesc ? metaDesc + '\n\n' + bodyText : bodyText;
                content = content.substring(0, maxLen);

                return content;
              },
              args: [maxLength]
            });

            const content = results?.[0]?.result || '';

            // Clean up
            clearTimeout(timeoutId);
            chrome.tabs.onUpdated.removeListener(updateListener);

            // Close the tab
            await chrome.tabs.remove(tab.id);

            console.log('[Background] ✓ Content extracted from tab (' + content.length + ' chars)');
            resolve(content);

          } catch (error) {
            clearTimeout(timeoutId);
            chrome.tabs.onUpdated.removeListener(updateListener);
            chrome.tabs.remove(tab.id).catch(() => {});
            reject(error);
          }
        }
      };

      chrome.tabs.onUpdated.addListener(updateListener);

    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to call AI for company research summarization
async function callAIForResearch(prompt) {
  console.log('[Background] Calling AI for company research summarization...');

  // Get AI settings from storage
  const { AI_PROVIDER, OPENAI_API_KEY, API_ENDPOINT, AI_MODEL } = await chrome.storage.local.get([
    'AI_PROVIDER',
    'OPENAI_API_KEY',
    'API_ENDPOINT',
    'AI_MODEL'
  ]);

  const aiProvider = AI_PROVIDER || 'openai';

  if (aiProvider === 'copilot') {
    // Use GitHub Copilot
    console.log('[Background] Using GitHub Copilot for company research');

    try {
      // Reset conversation for fresh context
      copilotAuth.resetConversation();

      // Call Copilot with the prompt
      const summary = await copilotAuth.chat(prompt, {
        temperature: 0.7,
        stream: false // Don't stream in background script
      });

      console.log('[Background] ✓ Copilot summarization complete (' + summary.length + ' chars)');
      return summary;

    } catch (copilotError) {
      // Check if it's a subscription/access error
      const copilotErrorMsg = copilotError?.message || String(copilotError);
      if (copilotErrorMsg.includes('not enabled') ||
          copilotErrorMsg.includes('Access denied') ||
          copilotErrorMsg.includes('403')) {
        throw new Error(
          `GitHub Copilot Error: ${copilotErrorMsg}\n\n` +
          `Please check your GitHub Copilot subscription or switch to OpenAI in extension options.`
        );
      }
      throw copilotError; // Re-throw other errors
    }

  } else if (aiProvider === 'openai') {
    // Use OpenAI
    if (!OPENAI_API_KEY) {
      throw new Error('No OpenAI API key configured. Please add it in options.');
    }

    const apiUrl = API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
    const aiModel = AI_MODEL || 'gpt-4o-mini';

    console.log('[Background] Using OpenAI - API URL:', apiUrl);
    console.log('[Background] Using OpenAI - Model:', aiModel);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: 'system',
            content: 'You are a company research assistant. Analyze company information and provide comprehensive, well-structured summaries.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const summary = data?.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      throw new Error('Empty response from AI');
    }

    console.log('[Background] ✓ AI summarization complete (' + summary.length + ' chars)');
    return summary;

  } else {
    throw new Error(`AI provider "${aiProvider}" is not supported for company research. Please use OpenAI or GitHub Copilot in options.`);
  }
}

// Company research function - REFACTORED
async function researchCompany(companyName, companyUrl, jobDescription, customUrls = [], manualContent = '') {
  console.log('[Background] ========================================');
  console.log('[Background] STARTING COMPANY RESEARCH');
  console.log('[Background] ========================================');
  console.log('[Background] Company Name:', companyName);
  console.log('[Background] Company URL:', companyUrl);
  console.log('[Background] Custom URLs:', JSON.stringify(customUrls, null, 2));
  console.log('[Background] Job Description Length:', jobDescription?.length || 0);
  console.log('[Background] Manual Content Length:', manualContent?.length || 0, 'chars');

  // Load settings from storage
  const { companyResearchSettings } = await chrome.storage.local.get(['companyResearchSettings']);
  const settings = companyResearchSettings || {
    characterLimit: 1000,
    enableLinkedIn: true,
    enableWebsite: true,
    enableCustomUrls: true
  };

  console.log('[Background] Settings:', JSON.stringify(settings, null, 2));
  const maxLength = settings.characterLimit || 1000;

  // Track results
  const sources = [];
  const collectedData = [];
  let linkedinSuccess = false;
  let linkedinError = null;
  let websiteSuccess = false;
  let websiteError = null;
  let websiteUrl = null;
  let customUrlsSuccess = 0;
  let linkedinContent = null;

  try {
    // 1. Extract "About the Company" from job description
    console.log('[Background] ----------------------------------------');
    console.log('[Background] STEP 1: Extracting from job description');
    console.log('[Background] ----------------------------------------');

    const aboutCompanyMatch = jobDescription.match(/About\s+(?:the\s+)?Company[:\s]+([\s\S]*?)(?=\n\n|$)/i);
    if (aboutCompanyMatch && aboutCompanyMatch[1]) {
      const aboutText = aboutCompanyMatch[1].trim();
      if (aboutText.length > 50) {
        collectedData.push({
          source: 'Job Description',
          content: aboutText,
          type: 'about_company'
        });
        sources.push('Job Description');
        console.log('[Background] ✓ Extracted "About the Company" section (' + aboutText.length + ' chars)');
      }
    }

    // Extract other company information from job description
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
        const alreadyHasThis = collectedData.some(d => d.content.includes(text.substring(0, 100)));
        if (text.length > 50 && !alreadyHasThis) {
          collectedData.push({
            source: 'Job Description',
            content: text,
            type: 'company_info'
          });
          if (!sources.includes('Job Description')) {
            sources.push('Job Description');
          }
          console.log('[Background] ✓ Extracted additional company info (' + text.length + ' chars)');
          break;
        }
      }
    }

    console.log('[Background] Job description extraction complete. Found ' + collectedData.length + ' sections');

    // 2. Try to scrape LinkedIn company page
    console.log('[Background] ----------------------------------------');
    console.log('[Background] STEP 2: Scraping LinkedIn company page');
    console.log('[Background] ----------------------------------------');
    console.log('[Background] LinkedIn enabled:', settings.enableLinkedIn);
    console.log('[Background] Company URL:', companyUrl);

    if (settings.enableLinkedIn && companyUrl && companyUrl.includes('linkedin.com/company')) {
      try {
        console.log('[Background] Attempting to scrape LinkedIn...');
        linkedinContent = await scrapeLinkedInCompanyPage(companyUrl, maxLength);
        if (linkedinContent && linkedinContent.length > 50) {
          collectedData.push({
            source: 'LinkedIn Company Page',
            content: linkedinContent,
            type: 'linkedin'
          });
          sources.push('LinkedIn Company Page');
          linkedinSuccess = true;
          console.log('[Background] ✓ LinkedIn scraped successfully (' + linkedinContent.length + ' chars)');
        } else {
          linkedinError = 'No content extracted from LinkedIn';
          console.log('[Background] ⚠️ LinkedIn returned empty content');
        }
      } catch (error) {
        linkedinError = error?.message || String(error);
        console.error('[Background] ✗ LinkedIn scraping failed:', linkedinError);
      }
    } else if (!settings.enableLinkedIn) {
      linkedinError = 'LinkedIn scraping disabled in settings';
      console.log('[Background] ⏭️ LinkedIn scraping disabled in settings');
    } else {
      linkedinError = 'No LinkedIn company URL available';
      console.log('[Background] ⏭️ No LinkedIn company URL provided');
    }

    // 3. Try to find and scrape company website
    console.log('[Background] ----------------------------------------');
    console.log('[Background] STEP 3: Finding and scraping company website');
    console.log('[Background] ----------------------------------------');
    console.log('[Background] Website scraping enabled:', settings.enableWebsite);

    if (settings.enableWebsite) {
      websiteUrl = findCompanyWebsiteUrl(jobDescription, linkedinContent);

      if (websiteUrl) {
        console.log('[Background] Found website URL:', websiteUrl);
        console.log('[Background] Attempting to fetch website with 30s timeout...');
        try {
          const websiteContent = await fetchUrlContent(websiteUrl, maxLength);
          if (websiteContent && websiteContent.length > 50) {
            collectedData.push({
              source: 'Company Website',
              content: websiteContent,
              type: 'website',
              url: websiteUrl
            });
            sources.push('Company Website');
            websiteSuccess = true;
            console.log('[Background] ✓ Website scraped successfully (' + websiteContent.length + ' chars)');
          } else {
            websiteError = 'No content extracted from website';
            console.log('[Background] ⚠️ Website returned empty content');
          }
        } catch (error) {
          websiteError = error?.message || String(error);
          console.error('[Background] ✗ Website scraping failed:', websiteError);

          // Try fallback: open in new tab
          console.log('[Background] → Trying fallback: opening URL in new tab...');
          try {
            const tabContent = await fetchContentFromNewTab(websiteUrl, maxLength);
            if (tabContent && tabContent.length > 50) {
              collectedData.push({
                source: 'Company Website (via browser tab)',
                content: tabContent,
                type: 'website',
                url: websiteUrl
              });
              sources.push('Company Website');
              websiteSuccess = true;
              websiteError = null; // Clear the error
              console.log('[Background] ✓ Website scraped via tab successfully (' + tabContent.length + ' chars)');
            } else {
              console.log('[Background] ✗ Tab-based scraping also failed (empty content)');
            }
          } catch (tabError) {
            const tabErrorMsg = tabError?.message || String(tabError);
            console.error('[Background] ✗ Tab-based scraping also failed:', tabErrorMsg);
            websiteError += ` (Tab fallback also failed: ${tabErrorMsg})`;
          }
        }
      } else {
        console.log('[Background] ⏭️ No company website URL found in job description or LinkedIn');
      }
    } else {
      websiteError = 'Website scraping disabled in settings';
      console.log('[Background] ⏭️ Website scraping disabled in settings');
    }

    // 4. Scrape custom URLs
    console.log('[Background] ----------------------------------------');
    console.log('[Background] STEP 4: Scraping custom URLs');
    console.log('[Background] ----------------------------------------');
    console.log('[Background] Custom URLs enabled:', settings.enableCustomUrls);
    console.log('[Background] Custom URLs array:', JSON.stringify(customUrls, null, 2));
    console.log('[Background] Custom URLs count:', customUrls ? customUrls.length : 0);

    if (settings.enableCustomUrls && customUrls && customUrls.length > 0) {
      console.log('[Background] Starting to fetch', customUrls.length, 'custom URLs...');

      for (let i = 0; i < customUrls.length; i++) {
        const url = customUrls[i];
        console.log(`[Background] ========== Custom URL ${i+1}/${customUrls.length} ==========`);
        console.log(`[Background] URL: ${url}`);

        try {
          // Check if this is a LinkedIn company page
          let content;
          if (url.includes('linkedin.com/company')) {
            console.log('[Background] → Detected LinkedIn company page, using LinkedIn scraper');
            content = await scrapeLinkedInCompanyPage(url, maxLength);
          } else {
            console.log('[Background] → Fetching as regular URL (timeout: 30s)...');
            const startTime = Date.now();
            content = await fetchUrlContent(url, maxLength);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`[Background] → Fetch completed in ${elapsed}s`);
          }

          console.log('[Background] → Content length:', content ? content.length : 0, 'chars');

          if (content && content.length > 50) {
            collectedData.push({
              source: 'Custom URL',
              content: content,
              type: 'custom_url',
              url: url
            });
            sources.push(`Custom URL`);
            customUrlsSuccess++;
            console.log(`[Background] ✓ Custom URL ${i+1} fetched successfully!`);
            console.log(`[Background] ✓ Total successful: ${customUrlsSuccess}/${customUrls.length}`);
          } else {
            console.log(`[Background] ⚠️ Content too short (${content ? content.length : 0} chars, need >50)`);
          }
        } catch (error) {
          const errorMsg = error?.message || String(error);
          console.error(`[Background] ✗ Custom URL ${i+1} FAILED:`, errorMsg);

          // Try fallback: open in new tab (skip for LinkedIn URLs)
          if (!url.includes('linkedin.com')) {
            console.log(`[Background] → Trying fallback: opening URL in new tab...`);
            try {
              const tabContent = await fetchContentFromNewTab(url, maxLength);
              if (tabContent && tabContent.length > 50) {
                collectedData.push({
                  source: 'Custom URL (via browser tab)',
                  content: tabContent,
                  type: 'custom_url',
                  url: url
                });
                sources.push(`Custom URL`);
                customUrlsSuccess++;
                console.log(`[Background] ✓ Custom URL ${i+1} fetched via tab successfully!`);
                console.log(`[Background] ✓ Total successful: ${customUrlsSuccess}/${customUrls.length}`);
              } else {
                console.log(`[Background] ✗ Tab-based scraping also failed (empty content)`);
              }
            } catch (tabError) {
              const tabErrorMsg = tabError?.message || String(tabError);
              console.error(`[Background] ✗ Tab-based scraping also failed:`, tabErrorMsg);
            }
          }
        }
        console.log(`[Background] ========================================`);
      }

      console.log('[Background] Custom URLs summary:', customUrlsSuccess, '/', customUrls.length, 'successful');
    } else if (!settings.enableCustomUrls) {
      console.log('[Background] ⏭️ Custom URLs scraping DISABLED in settings');
    } else if (!customUrls || customUrls.length === 0) {
      console.log('[Background] ⏭️ No custom URLs provided');
    }

    // 5. Add manual content if provided
    console.log('[Background] ----------------------------------------');
    console.log('[Background] STEP 5: Processing manual content');
    console.log('[Background] ----------------------------------------');

    if (manualContent && manualContent.length > 50) {
      console.log('[Background] Manual content provided:', manualContent.length, 'chars');
      collectedData.push({
        source: 'Manual Content',
        content: manualContent,
        type: 'manual'
      });
      sources.push('Manual Content');
      console.log('[Background] ✓ Manual content added to research');
    } else if (manualContent && manualContent.length > 0) {
      console.log('[Background] ⚠️ Manual content too short (', manualContent.length, 'chars, need >50)');
    } else {
      console.log('[Background] ⏭️ No manual content provided');
    }

    // 6. Compile all collected data into final description
    console.log('[Background] ----------------------------------------');
    console.log('[Background] STEP 6: Compiling final description');
    console.log('[Background] ----------------------------------------');
    console.log('[Background] Total data sections collected:', collectedData.length);
    console.log('[Background] Sources:', sources.join(', '));

    let description = '';
    let rawResearch = '';

    if (collectedData.length > 0) {
      // First, compile raw research data
      rawResearch = `**${companyName}**\n\n`;
      for (const data of collectedData) {
        const header = data.url ? `**${data.source}** (${data.url})` : `**${data.source}**`;
        rawResearch += `${header}:\n${data.content}\n\n`;
      }

      console.log('[Background] ✓ Compiled raw research from', collectedData.length, 'sources');
      console.log('[Background] ✓ Raw research length:', rawResearch.length, 'chars');

      // Check if custom AI prompt is configured
      const customPrompt = settings.customPrompt || '';

      if (customPrompt && customPrompt.trim().length > 0) {
        console.log('[Background] ----------------------------------------');
        console.log('[Background] STEP 7: AI Summarization');
        console.log('[Background] ----------------------------------------');
        console.log('[Background] Custom prompt found, using AI to summarize...');

        try {
          // Collect all company links for the AI
          const companyLinks = [];

          // Add LinkedIn URL if available
          if (companyUrl) {
            companyLinks.push(companyUrl);
          }

          // Add website URL if found
          if (websiteUrl) {
            companyLinks.push(websiteUrl);
          }

          // Add custom URLs
          if (customUrls && customUrls.length > 0) {
            companyLinks.push(...customUrls);
          }

          // Format links as a bulleted list
          const companyLinksText = companyLinks.length > 0
            ? companyLinks.map(link => `- ${link}`).join('\n')
            : 'No links available';

          console.log('[Background] Company links for AI:', companyLinks.length, 'links');

          // Replace variables in the custom prompt
          let aiPrompt = customPrompt
            .replace(/{company_name}/g, companyName)
            .replace(/{job_title}/g, 'N/A') // We don't have job title in background.js
            .replace(/{job_description}/g, jobDescription || 'N/A')
            .replace(/{raw_research}/g, rawResearch)
            .replace(/{company_links}/g, companyLinksText);

          console.log('[Background] AI prompt length:', aiPrompt.length, 'chars');

          // Call AI to summarize
          description = await callAIForResearch(aiPrompt);
          sources.push('AI Summary');

          console.log('[Background] ✓ AI summarization successful');
          console.log('[Background] ✓ AI summary length:', description.length, 'chars');
        } catch (aiError) {
          const aiErrorMsg = aiError?.message || String(aiError);
          console.error('[Background] ✗ AI summarization failed:', aiErrorMsg);
          console.log('[Background] ⚠️ Falling back to raw research data');

          // Fallback to raw research with error note
          description = `**${companyName}**\n\n`;
          description += `**⚠️ AI Summarization Failed:** ${aiErrorMsg}\n\n`;
          description += `**Raw Research Data:**\n\n${rawResearch}`;
        }
      } else {
        console.log('[Background] ⏭️ No custom AI prompt configured, using raw research data');
        description = rawResearch;
      }
    } else {
      description = `**${companyName}**\n\nNo detailed company information was found.\n\n`;
      description += `**Troubleshooting:**\n`;
      description += `- LinkedIn: ${linkedinError || 'Not attempted'}\n`;
      description += `- Website: ${websiteError || 'Not attempted'}\n`;
      description += `- Custom URLs: ${customUrlsSuccess}/${customUrls?.length || 0} successful\n\n`;
      description += `**Suggestions:**\n`;
      description += `- Try adding custom URLs to the company's website\n`;
      description += `- Check if the company's LinkedIn page is public\n`;
      description += `- Some websites block automated requests - try opening them in your browser first\n`;
      sources.push('Basic Info');
      console.log('[Background] ⚠️ No data collected, returning troubleshooting message');
    }

    console.log('[Background] ========================================');
    console.log('[Background] RESEARCH COMPLETE');
    console.log('[Background] ========================================');
    console.log('[Background] Final stats:');
    console.log('[Background]   - LinkedIn:', linkedinSuccess ? 'SUCCESS' : 'FAILED (' + (linkedinError || 'unknown') + ')');
    console.log('[Background]   - Website:', websiteSuccess ? 'SUCCESS' : 'FAILED (' + (websiteError || 'unknown') + ')');
    console.log('[Background]   - Custom URLs:', customUrlsSuccess, '/', (customUrls?.length || 0));
    console.log('[Background]   - Total sources:', sources.length);
    console.log('[Background]   - Description length:', description.length, 'chars');

    return {
      description: description.trim(),
      sources: sources,
      linkedinSuccess,
      linkedinError,
      websiteSuccess,
      websiteError,
      websiteUrl,
      customUrlsSuccess
    };

  } catch (error) {
    console.error('[Background] ========================================');
    console.error('[Background] FATAL ERROR IN RESEARCH');
    console.error('[Background] ========================================');
    console.error('[Background] Error:', error);
    const errorMsg = error?.message || String(error);
    console.error('[Background] Error message:', errorMsg);
    console.error('[Background] Stack:', error?.stack);
    throw new Error(`Failed to research company: ${errorMsg}`);
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
        sendResponse({ success: false, error: error?.message || String(error) });
      });
    return true; // Keep the message channel open for async response
  } else if (message.type === 'GET_JOB_CACHE') {
    getJobCache(message.jobId)
      .then(cache => {
        sendResponse({ success: true, cache });
      })
      .catch(error => {
        sendResponse({ success: false, error: error?.message || String(error) });
      });
    return true;
  } else if (message.type === 'SET_JOB_CACHE') {
    setJobCache(message.jobId, message.cacheData)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error?.message || String(error) });
      });
    return true;
  } else if (message.type === 'GET_JOB_TRACKING') {
    getJobTracking(message.jobId)
      .then(tracking => {
        sendResponse({ success: true, tracking });
      })
      .catch(error => {
        sendResponse({ success: false, error: error?.message || String(error) });
      });
    return true;
  } else if (message.type === 'SET_JOB_TRACKING') {
    setJobTracking(message.jobId, message.trackingData)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error?.message || String(error) });
      });
    return true;
  } else if (message.type === 'GET_ALL_TRACKED_JOBS') {
    getAllTrackedJobs()
      .then(jobs => {
        sendResponse({ success: true, jobs });
      })
      .catch(error => {
        sendResponse({ success: false, error: error?.message || String(error) });
      });
    return true;
  } else if (message.type === 'CLEAR_ALL_TRACKING') {
    clearAllTracking()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error?.message || String(error) });
      });
    return true;
  } else if (message.type === 'CLEAR_ALL_JOB_CACHES') {
    clearAllJobCaches()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error?.message || String(error) });
      });
    return true;
  } else if (message.type === 'RESEARCH_COMPANY') {
    // Handle company research request
    console.log('[Background] Researching company:', message.companyName);
    researchCompany(message.companyName, message.companyUrl, message.jobDescription, message.customUrls, message.manualContent)
      .then(result => {
        console.log('[Background] Company research completed');
        sendResponse({
          success: true,
          description: result.description,
          sources: result.sources,
          linkedinSuccess: result.linkedinSuccess,
          linkedinError: result.linkedinError,
          websiteSuccess: result.websiteSuccess,
          websiteError: result.websiteError,
          websiteUrl: result.websiteUrl,
          customUrlsSuccess: result.customUrlsSuccess
        });
      })
      .catch(error => {
        console.error('[Background] Company research error:', error);
        sendResponse({ success: false, error: error?.message || String(error) });
      });
    return true;
  }
  return true;
});

