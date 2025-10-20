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

const companyNamesMatch = (searchName, csvName) => {
  const n1 = normalizeCompanyName(searchName);
  const n2 = normalizeCompanyName(csvName);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  const core1 = extractCoreCompanyName(searchName);
  const core2 = extractCoreCompanyName(csvName);
  if (core1 === core2 && core1.length > 0) return true;
  if (core1.length <= 5 || core2.length <= 5) {
    return core1 === core2;
  }
  if (core1.length > 5 && n2.startsWith(core1)) return true;
  if (core2.length > 5 && n1.startsWith(core2)) return true;
  return false;
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
        const searchCore = extractCoreCompanyName(companyName);

        for (const row of allCompanies) {
          const orgName = row['Organisation Name'] || '';
          if (companyNamesMatch(companyName, orgName)) {
            const csvCore = extractCoreCompanyName(orgName);
            let score = 0;
            if (normalizeCompanyName(companyName) === normalizeCompanyName(orgName)) {
              score = 100;
            } else if (searchCore === csvCore) {
              score = 90;
            } else if (normalizeCompanyName(orgName).startsWith(normalizeCompanyName(companyName))) {
              score = 80;
            } else {
              score = 50;
            }
            matches.push({ ...row, matchScore: score });
          }
        }

        matches.sort((a, b) => b.matchScore - a.matchScore);
        const topMatches = matches.slice(0, 5);
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

// Clear expired cache on startup
clearExpiredCache().then(count => {
  if (count > 0) {
    console.log(`[Background] Cleared ${count} expired job cache entries`);
  }
});

// Listen for messages from content script and forward to side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'JOB_DATA_UPDATED') {
    // Forward the message to all side panels
    // The side panel will receive this via chrome.runtime.onMessage
    console.log('Job data updated, forwarding to side panel');
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
  }
  return true;
});

