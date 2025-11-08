// Content script for LinkedIn job pages
// Monitors job details and sends updates to the side panel

console.log('[Content Script] ========================================');
console.log('[Content Script] LinkedIn Job Scraper Extension Loading...');
console.log('[Content Script] ========================================');

let lastJobText = '';
let observerActive = false;
let badgeScannerActive = false;
let scannedJobs = new Map(); // Track which jobs have been scanned with their badge data
let badgeSettings = null; // Cache badge settings
let currentJobId = null; // Track currently viewed job

// Normalize text function (same as in popup.js)
const normalizeText = (t) => {
  if (!t) {
    return '';
  }
  return t
    .replace(/\u00A0/g, ' ')         // non-breaking spaces -> normal spaces
    .replace(/\r/g, '')              // CR
    .replace(/[ \t]+\n/g, '\n')      // trailing spaces before newline
    .replace(/\n{3,}/g, '\n\n')      // more than 2 empty lines -> 1 empty line
    .replace(/[ \t]{2,}/g, ' ')      // multiple spaces
    .trim();
};

// Normalize company name for comparison
const normalizeCompanyName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s&]/g, '')
    .trim();
};

// Extract core company name (remove common suffixes)
const extractCoreCompanyName = (name) => {
  if (!name) return '';

  let core = normalizeCompanyName(name);

  // Remove common company suffixes
  const suffixes = [
    'limited', 'ltd', 'plc', 'llc', 'inc', 'incorporated',
    'corporation', 'corp', 'company', 'co', 'group', 'holdings',
    'international', 'intl', 'uk', 'usa', 'us', 'europe', 'global'
  ];

  // Remove suffixes from the end
  for (const suffix of suffixes) {
    const regex = new RegExp(`\\s+${suffix}$`, 'gi');
    core = core.replace(regex, '').trim();
  }

  return core;
};

// Check if two company names match (strict matching)
const companyNamesMatch = (searchName, csvName) => {
  const n1 = normalizeCompanyName(searchName);
  const n2 = normalizeCompanyName(csvName);

  if (!n1 || !n2) return false;

  // Exact match after normalization
  if (n1 === n2) return true;

  // Extract core names (without suffixes)
  const core1 = extractCoreCompanyName(searchName);
  const core2 = extractCoreCompanyName(csvName);

  // Core names must match exactly
  if (core1 === core2 && core1.length > 0) return true;

  // For very short names (like "Teya"), require exact match of the core
  if (core1.length <= 5 || core2.length <= 5) {
    // Only match if one core is exactly the other (not just contains)
    return core1 === core2;
  }

  // For longer names, check if the search name is contained in CSV name
  // But only if it's at the start (to avoid false matches)
  if (core1.length > 5 && n2.startsWith(core1)) {
    return true;
  }

  if (core2.length > 5 && n1.startsWith(core2)) {
    return true;
  }

  return false;
};

// Search companies via background script (content scripts can't access extension IndexedDB)
const searchCompaniesInIndexedDB = async (companyName) => {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      console.log('[Badge Scanner] Extension context invalidated, cannot search database');
      return [];
    }

    console.log('[Badge Scanner] Sending search request to background script for:', companyName);

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'SEARCH_VISA_SPONSOR', companyName },
        (response) => {
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message || '';
            if (errorMsg.includes('Extension context invalidated')) {
              console.log('[Badge Scanner] Extension was reloaded, please refresh the page');
            } else {
              console.error('[Badge Scanner] Message error:', chrome.runtime.lastError);
            }
            resolve([]); // Return empty array instead of rejecting
            return;
          }

          if (response && response.success) {
            console.log('[Badge Scanner] Received matches from background:', response.matches.length);
            resolve(response.matches);
          } else {
            console.error('[Badge Scanner] Search failed:', response?.error);
            resolve([]);
          }
        }
      );
    });
  } catch (error) {
    console.error('[Badge Scanner] Error searching IndexedDB:', error);
    return [];
  }
};

// Extract company name from the page
const extractCompanyName = () => {
  console.log('[LinkedIn Scraper] Attempting to extract company name...');

  // Try multiple selectors in order of reliability
  const selectors = [
    // Primary - the div with class and anchor inside
    { selector: '.job-details-jobs-unified-top-card__company-name a', name: 'Primary (div.company-name > a)' },
    { selector: '.job-details-jobs-unified-top-card__company-name', name: 'Primary (div.company-name)', getAnchor: true },
    // Alternative - look for any anchor with company link in the top card area
    { selector: '.job-details-jobs-unified-top-card__container--two-pane a[href*="/company/"]', name: 'Top card company link' },
    { selector: '.display-flex.align-items-center.flex-1 > div > a', name: 'Flex container anchor' },
    // Fallbacks
    { selector: '.jobs-unified-top-card__company-name a', name: 'Fallback 1' },
    { selector: '.jobs-unified-top-card__company-name', name: 'Fallback 2', getAnchor: true },
    { selector: 'a[data-tracking-control-name="public_jobs_topcard-org-name"]', name: 'Fallback 3' },
  ];

  for (const { selector, name, getAnchor } of selectors) {
    console.log(`[LinkedIn Scraper] Trying selector: ${name} (${selector})`);
    let el = document.querySelector(selector);

    if (el) {
      console.log(`[LinkedIn Scraper] Element found:`, el);

      // If we need to get anchor from inside the element
      if (getAnchor) {
        const anchor = el.querySelector('a');
        if (anchor) {
          el = anchor;
          console.log(`[LinkedIn Scraper] Found anchor inside:`, anchor);
        }
      }

      let companyName = (el.innerText || el.textContent || '').trim();
      console.log(`[LinkedIn Scraper] Raw text: "${companyName}"`);

      // Clean up the text
      companyName = companyName
        .replace(/\s*·\s*Follow\s*/gi, '')
        .replace(/\s*Follow\s*/gi, '')
        .replace(/\n/g, ' ')
        .trim();

      console.log(`[LinkedIn Scraper] Cleaned text: "${companyName}"`);

      if (companyName && companyName.length > 0 && companyName.length < 100) {
        console.log(`[LinkedIn Scraper] ✓ SUCCESS! Found company name: "${companyName}" using ${name}`);
        return companyName;
      }
    } else {
      console.log(`[LinkedIn Scraper] Element not found for: ${name}`);
    }
  }

  console.log('[LinkedIn Scraper] ❌ FAILED - Could not find company name with any selector');
  console.log('[LinkedIn Scraper] Available elements with "company" in class:',
    Array.from(document.querySelectorAll('[class*="company"]')).map(el => ({
      tag: el.tagName,
      class: el.className,
      text: (el.innerText || el.textContent || '').substring(0, 50)
    }))
  );

  return null;
};

// Wait for company name element to appear
const waitForCompanyName = (timeout = 3000) => {
  console.log('[LinkedIn Scraper] waitForCompanyName() called, timeout:', timeout);
  return new Promise((resolve) => {
    const startTime = Date.now();
    let attemptCount = 0;

    const checkCompanyName = () => {
      attemptCount++;
      console.log(`[LinkedIn Scraper] Attempt ${attemptCount} to extract company name...`);
      const companyName = extractCompanyName();

      if (companyName) {
        console.log(`[LinkedIn Scraper] ✓ Company name found after ${attemptCount} attempts:`, companyName);
        resolve(companyName);
        return;
      }

      // Keep trying until timeout
      const elapsed = Date.now() - startTime;
      if (elapsed < timeout) {
        console.log(`[LinkedIn Scraper] Retrying in 200ms... (${elapsed}ms elapsed)`);
        setTimeout(checkCompanyName, 200);
      } else {
        console.log(`[LinkedIn Scraper] ⏱ Timeout after ${attemptCount} attempts (${elapsed}ms)`);
        resolve(null);
      }
    };

    checkCompanyName();
  });
};

// Extract job details from the page
const extractJobDetails = async () => {
  console.log('[LinkedIn Scraper] extractJobDetails() called');

  // IMPORTANT: Use specific job description selectors to avoid including badge elements
  // The .jobs-search__job-details--wrapper contains badges, which creates false positives
  // Use the actual job description container instead
  const jobDetailsEl = document.querySelector('.jobs-description__content') ||
                       document.querySelector('.jobs-box__html-content') ||
                       document.querySelector('.jobs-description') ||
                       document.querySelector('article.jobs-description__container') ||
                       document.querySelector('.jobs-search__job-details--wrapper') ||
                       document.querySelector('#job-details > div');

  if (!jobDetailsEl) {
    console.log('[LinkedIn Scraper] No job details element found');
    return null;
  }

  const text = jobDetailsEl.innerText || jobDetailsEl.textContent || '';
  const cleaned = normalizeText(text);

  // Extract job ID from URL - try multiple patterns
  const url = window.location.href;
  console.log('[Badge Scanner] Current URL:', url);

  let jobId = null;

  // Try different URL patterns
  const patterns = [
    /\/jobs\/view\/(\d+)/,           // /jobs/view/123456
    /\/jobs\/collections\/[^/]+\/(\d+)/, // /jobs/collections/recommended/123456
    /currentJobId=(\d+)/,             // ?currentJobId=123456
    /\/jobs\/search\/[^/]*\?currentJobId=(\d+)/, // /jobs/search/?currentJobId=123456
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      jobId = match[1];
      console.log('[Badge Scanner] Job ID extracted using pattern:', pattern, '→', jobId);
      break;
    }
  }

  if (!jobId) {
    console.log('[Badge Scanner] Could not extract job ID from URL');
  }

  // Only send if the content has changed
  if (cleaned && cleaned !== lastJobText) {
    console.log('[LinkedIn Scraper] New job text detected, length:', cleaned.length);
    lastJobText = cleaned;
    currentJobId = jobId;

    // Wait for company name to load (with timeout)
    console.log('[LinkedIn Scraper] Starting company name extraction...');
    const companyName = await waitForCompanyName(3000);
    console.log('[LinkedIn Scraper] Final company name:', companyName);

    // Extract job title
    const jobTitleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title h1') ||
                       document.querySelector('.jobs-unified-top-card__job-title h1') ||
                       document.querySelector('.jobs-details-top-card__job-title h1');
    const jobTitle = jobTitleEl ? jobTitleEl.textContent.trim() : '';
    console.log('[LinkedIn Scraper] Job title:', jobTitle);

    // Extract company LinkedIn URL
    let companyUrl = '';
    const companyLinkEl = document.querySelector('.job-details-jobs-unified-top-card__company-name a') ||
                          document.querySelector('.jobs-unified-top-card__company-name a') ||
                          document.querySelector('.jobs-details-top-card__company-url');
    if (companyLinkEl && companyLinkEl.href) {
      companyUrl = companyLinkEl.href;
      console.log('[LinkedIn Scraper] Company URL:', companyUrl);
    } else {
      console.log('[LinkedIn Scraper] No company URL found');
    }

    // Trigger badge analysis for this job
    console.log('[Badge Scanner] Checking if should analyze job...');
    console.log('[Badge Scanner] - jobId:', jobId);
    console.log('[Badge Scanner] - badgeSettings:', badgeSettings);
    console.log('[Badge Scanner] - badgeSettings.enabled:', badgeSettings?.enabled);

    if (jobId && badgeSettings && badgeSettings.enabled) {
      console.log('[Badge Scanner] ✓ Triggering badge analysis');
      await analyzeCurrentJobAndUpdateBadges(jobId, cleaned);
    } else {
      console.log('[Badge Scanner] ✗ Skipping badge analysis');
      if (!jobId) console.log('[Badge Scanner]   - No job ID');
      if (!badgeSettings) console.log('[Badge Scanner]   - Badge settings not loaded');
      if (badgeSettings && !badgeSettings.enabled) console.log('[Badge Scanner]   - Badge scanner disabled');
    }

    return {
      text: cleaned,
      companyName: companyName,
      jobTitle: jobTitle,
      companyUrl: companyUrl
    };
  }

  console.log('[LinkedIn Scraper] Job text unchanged, skipping');
  return null;
};

// Send job data to the side panel
const sendJobDataToSidePanel = (jobData) => {
  // Check if extension context is still valid
  if (!chrome.runtime?.id) {
    console.error('[LinkedIn Scraper] Extension context invalidated, skipping message');
    return;
  }

  console.log('[LinkedIn Scraper] Sending job data to side panel:', {
    companyName: jobData.companyName,
    jobTitle: jobData.jobTitle,
    companyUrl: jobData.companyUrl,
    url: window.location.href
  });

  chrome.runtime.sendMessage({
    type: 'JOB_DATA_UPDATED',
    data: {
      text: jobData.text,
      companyName: jobData.companyName,
      jobTitle: jobData.jobTitle,
      companyUrl: jobData.companyUrl,
      url: window.location.href,
      timestamp: Date.now()
    }
  }).then(() => {
    console.log('[LinkedIn Scraper] Message sent successfully');
  }).catch((err) => {
    // Side panel might not be open yet, that's okay
    // Also catch "Extension context invalidated" errors
    if (err.message.includes('Extension context invalidated')) {
      console.error('[LinkedIn Scraper] Extension was reloaded, please refresh the page');
    } else {
      console.warn('[LinkedIn Scraper] Could not send to side panel:', err.message);
    }
  });
};

// Check for job details and send if found
const checkAndSendJobDetails = async () => {
  const jobData = await extractJobDetails();
  if (jobData) {
    console.log('Job details found, sending to side panel');
    console.log('Company name in job data:', jobData.companyName);
    sendJobDataToSidePanel(jobData);
  }
};

// Set up observer to watch for DOM changes
const setupObserver = () => {
  if (observerActive) return;

  const targetNode = document.body;
  const config = { childList: true, subtree: true };

  const callback = (mutationsList, observer) => {
    // Debounce: check for job details after mutations
    clearTimeout(window.jobCheckTimeout);
    window.jobCheckTimeout = setTimeout(() => {
      checkAndSendJobDetails();
      // Also highlight keywords on the page
      highlightKeywordsOnPage();
    }, 500);
  };

  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
  observerActive = true;

  console.log('LinkedIn job observer started');
};

// Initialize when page loads
const init = () => {
  console.log('LinkedIn Job Scraper content script loaded');

  // Check immediately
  setTimeout(() => {
    checkAndSendJobDetails();
    // Highlight keywords on initial load
    highlightKeywordsOnPage();
  }, 1000);

  // Set up observer for future changes
  setupObserver();

  // Also check when user scrolls (in case they scroll through job list)
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(checkAndSendJobDetails, 300);
  }, { passive: true });

  // Listen for clicks on job listings
  document.addEventListener('click', async (e) => {
    // Check if clicked element is or is within a job card
    const jobCard = e.target.closest('.job-card-container, .jobs-search-results__list-item');
    if (jobCard) {
      setTimeout(checkAndSendJobDetails, 500);

      // Track job as viewed and force rescan
      const jobId = jobCard.getAttribute('data-occludable-job-id');
      if (jobId && badgeSettings && badgeSettings.enabled) {
        console.log(`[Job Tracking] Job ${jobId} clicked (viewed)`);
        const tracking = await getJobTrackingFromDB(jobId) || {};
        const isFirstView = !tracking.viewedAt;

        tracking.viewedAt = Date.now();
        await setJobTrackingInDB(jobId, tracking);
        console.log(`[Job Tracking] ✓ Marked job ${jobId} as viewed`);

        // Force rescan on click to get fresh data
        if (isFirstView) {
          console.log(`[Job Tracking] First view - forcing rescan for job ${jobId}`);
          setTimeout(() => {
            scanJobCardInBackground(jobCard, true); // Force rescan
          }, 1000);
        } else {
          // Just update badges with tracking info
          const badges = scannedJobs.get(jobId) || [];
          await addBadgesToCard(jobCard, badges);
        }
      }
    }

    // Check if clicked element is an Apply button
    const applyButton = e.target.closest('.jobs-apply-button, .jobs-apply-button--top-card, button[aria-label*="Apply"], button[aria-label*="Easy Apply"]');
    if (applyButton) {
      // Get the current job ID from URL
      const url = window.location.href;
      const match = url.match(/\/jobs\/view\/(\d+)/);
      if (match) {
        const jobId = match[1];
        console.log(`[Job Tracking] Apply button clicked for job ${jobId}`);
        const tracking = await getJobTrackingFromDB(jobId) || {};
        tracking.appliedAt = Date.now();
        if (!tracking.viewedAt) {
          tracking.viewedAt = Date.now();
        }
        await setJobTrackingInDB(jobId, tracking);
        console.log(`[Job Tracking] ✓ Marked job ${jobId} as applied`);

        // Update badges on all cards with this job ID
        if (badgeSettings && badgeSettings.enabled) {
          const cards = document.querySelectorAll(`li[data-occludable-job-id="${jobId}"]`);
          const badges = scannedJobs.get(jobId) || [];
          cards.forEach(card => addBadgesToCard(card, badges));
        }
      }
    }
  }, true);
};

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Listen for messages from side panel (e.g., requesting current job data)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[LinkedIn Scraper] Received message:', message.type);

  if (message.type === 'REQUEST_JOB_DATA') {
    console.log('[LinkedIn Scraper] Side panel requested job data');
    // Handle async extraction
    extractJobDetails().then(jobData => {
      console.log('[LinkedIn Scraper] Extracted job data for REQUEST_JOB_DATA:', jobData ? {
        companyName: jobData.companyName,
        jobTitle: jobData.jobTitle,
        companyUrl: jobData.companyUrl
      } : null);

      sendResponse({
        success: true,
        data: jobData ? {
          text: jobData.text,
          companyName: jobData.companyName,
          jobTitle: jobData.jobTitle,
          companyUrl: jobData.companyUrl,
          url: window.location.href,
          timestamp: Date.now()
        } : null
      });
    });
    return true; // Keep the message channel open for async response
  }
  return true;
});

// ============================================================================
// BADGE SCANNER MODULE - Scans job listings and displays badges
// ============================================================================

// Load badge settings from storage
const loadBadgeSettings = async () => {
  const settings = await chrome.storage.local.get([
    'ENABLE_BADGE_SCANNER',
    'ENABLE_VISA_BADGE',
    'BADGE_KEYWORDS'
  ]);

  // Parse badge keywords
  const badgeKeywords = [];
  if (settings.BADGE_KEYWORDS) {
    const lines = settings.BADGE_KEYWORDS.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        const parts = trimmed.split('|');
        const keyword = parts[0]?.trim().toLowerCase();
        const color = parts[1]?.trim() || '#2196f3'; // Default blue
        if (keyword) {
          badgeKeywords.push({ keyword, color });
        }
      }
    }
  }

  badgeSettings = {
    enabled: settings.ENABLE_BADGE_SCANNER === true, // Explicitly check for true
    visaBadgeEnabled: settings.ENABLE_VISA_BADGE !== false, // Default true
    keywords: badgeKeywords
  };

  console.log('[Badge Scanner] Settings loaded:', badgeSettings);
  console.log('[Badge Scanner] Raw ENABLE_BADGE_SCANNER value:', settings.ENABLE_BADGE_SCANNER);
  return badgeSettings;
};

// Get all job listing cards in the left panel
const getJobListingCards = () => {
  console.log('[Badge Scanner] getJobListingCards() called');

  // Based on actual LinkedIn HTML: li.scaffold-layout__list-item with data-occludable-job-id
  const cards = document.querySelectorAll('li.scaffold-layout__list-item[data-occludable-job-id]');

  console.log(`[Badge Scanner] Selector: li.scaffold-layout__list-item[data-occludable-job-id]`);
  console.log(`[Badge Scanner] Found ${cards.length} job cards`);

  if (cards.length > 0) {
    // Log first card for debugging
    console.log('[Badge Scanner] First card:', cards[0]);
    console.log('[Badge Scanner] First card job ID:', cards[0].getAttribute('data-occludable-job-id'));
    return Array.from(cards);
  }

  console.log('[Badge Scanner] ⚠️ No job cards found! Checking if page structure exists...');
  const listContainer = document.querySelector('.scaffold-layout__list');
  console.log('[Badge Scanner] List container exists:', !!listContainer);

  return [];
};

// Extract job ID from a job card
const getJobIdFromCard = (card) => {
  // Based on actual HTML: data-occludable-job-id on the li element
  let jobId = card.getAttribute('data-occludable-job-id');

  if (jobId) {
    console.log(`[Badge Scanner] Extracted job ID from data attribute: ${jobId}`);
    return jobId;
  }

  // Fallback: try to get from the inner div's data-job-id attribute
  const innerDiv = card.querySelector('[data-job-id]');
  if (innerDiv) {
    jobId = innerDiv.getAttribute('data-job-id');
    console.log(`[Badge Scanner] Extracted job ID from inner div: ${jobId}`);
    return jobId;
  }

  // Last resort: extract from link href
  const link = card.querySelector('a.job-card-container__link');
  if (link && link.href) {
    const match = link.href.match(/\/jobs\/view\/(\d+)/);
    if (match) {
      console.log(`[Badge Scanner] Extracted job ID from link: ${match[1]}`);
      return match[1];
    }
  }

  console.log('[Badge Scanner] Could not extract job ID from card');
  return null;
};

// Extract company name from a job card
const getCompanyNameFromCard = (card) => {
  console.log('[Badge Scanner] Attempting to extract company name from card...');

  // Try multiple selectors for company name in job cards
  const selectors = [
    '.job-card-container__primary-description', // Common location for company name
    '.artdeco-entity-lockup__subtitle',
    '.job-card-container__company-name',
    '[data-job-card-company-name]',
    '.job-card-list__entity-lockup .artdeco-entity-lockup__subtitle'
  ];

  for (const selector of selectors) {
    const element = card.querySelector(selector);
    if (element) {
      let companyName = (element.innerText || element.textContent || '').trim();

      // Clean up the text
      companyName = companyName
        .replace(/\s*·\s*Follow\s*/gi, '')
        .replace(/\s*Follow\s*/gi, '')
        .replace(/\n/g, ' ')
        .trim();

      if (companyName && companyName.length > 0 && companyName.length < 100) {
        console.log(`[Badge Scanner] ✓ Found company name from card: "${companyName}" using ${selector}`);
        return companyName;
      }
    }
  }

  console.log('[Badge Scanner] Could not extract company name from card');
  return null;
};

// Check if job description contains visa sponsorship keywords OR company is in CSV
const checkVisaSponsorship = async (jobText, companyName) => {
  console.log(`[Badge Scanner] checkVisaSponsorship called with company: "${companyName}"`);

  // First check: Look for visa keywords in job description
  const visaKeywords = [
    'visa sponsorship',
    'visa sponsor',
    'sponsorship available',
    'will sponsor',
    'can sponsor',
    'sponsorship provided',
    'h1b',
    'h-1b',
    'work authorization',
    'right to work'
  ];

  const lowerText = jobText.toLowerCase();
  const hasVisaKeywords = visaKeywords.some(keyword => lowerText.includes(keyword));

  if (hasVisaKeywords) {
    console.log(`[Badge Scanner] ✓ Visa keywords found in job description`);
    return true;
  }

  // Second check: Look up company in CSV database
  if (companyName && companyName.trim()) {
    console.log(`[Badge Scanner] Checking CSV database for company: "${companyName}"`);
    try {
      const matches = await searchCompaniesInIndexedDB(companyName);
      if (matches && matches.length > 0) {
        const topMatch = matches[0];
        const confidence = topMatch.confidence || topMatch.matchScore || 100;
        console.log(`[Badge Scanner] ✓ Company found in CSV database with ${matches.length} matches`);
        console.log(`[Badge Scanner] Top match: ${topMatch['Organisation Name']} (confidence: ${confidence}%)`);

        // Return object with confidence score and all matches for side panel display
        return {
          found: true,
          confidence: confidence,
          matchedName: topMatch['Organisation Name'],
          allMatches: matches.slice(0, 5).map(m => ({
            name: m['Organisation Name'],
            score: m.confidence || m.matchScore
          }))
        };
      } else {
        console.log(`[Badge Scanner] Company not found in CSV database`);
      }
    } catch (error) {
      console.error(`[Badge Scanner] Error checking CSV database:`, error);
    }
  } else {
    console.log(`[Badge Scanner] No company name provided for CSV check`);
  }

  return { found: false, confidence: 0, allMatches: [] };
};

// Check which keywords are present in job description
const checkKeywordsInJob = (jobText, keywords) => {
  const lowerText = jobText.toLowerCase();
  const foundKeywords = [];

  for (const { keyword, color } of keywords) {
    if (lowerText.includes(keyword)) {
      foundKeywords.push({ keyword, color });
    }
  }

  return foundKeywords;
};

// Analyze current job and update badges for its card
const analyzeCurrentJobAndUpdateBadges = async (jobId, jobDescription) => {
  console.log(`[Badge Scanner] ========================================`);
  console.log(`[Badge Scanner] Analyzing job ${jobId}...`);
  console.log(`[Badge Scanner] Job description length: ${jobDescription.length}`);
  console.log(`[Badge Scanner] Badge settings:`, badgeSettings);

  // Extract company name from the page
  const companyName = extractCompanyName();
  console.log(`[Badge Scanner] Extracted company name: "${companyName}"`);

  // Analyze job description
  const badges = [];

  // Check visa sponsorship
  if (badgeSettings.visaBadgeEnabled) {
    const visaResult = await checkVisaSponsorship(jobDescription, companyName);
    console.log(`[Badge Scanner] Visa sponsorship check:`, visaResult);
    if (visaResult.found) {
      // Always show "✓ Visa" without percentage on badges
      // Detailed match info will be shown in side panel
      badges.push({
        text: '✓ Visa',
        color: '#f44336',
        isVisa: true,
        confidence: visaResult.confidence,
        matchedName: visaResult.matchedName,
        allMatches: visaResult.allMatches || [] // Store all matches for side panel
      });
    }
  }

  // Check keywords
  const foundKeywords = checkKeywordsInJob(jobDescription, badgeSettings.keywords);
  console.log(`[Badge Scanner] Found ${foundKeywords.length} matching keywords:`, foundKeywords);
  foundKeywords.forEach(({ keyword, color }) => {
    badges.push({ text: keyword, color, isVisa: false });
  });

  console.log(`[Badge Scanner] Total badges to add: ${badges.length}`);

  // Store the badge data
  scannedJobs.set(jobId, badges);

  // Find the card for this job and add badges
  const card = findJobCardById(jobId);
  console.log(`[Badge Scanner] Found card for job ${jobId}:`, card ? 'YES' : 'NO');

  if (card) {
    if (badges.length > 0) {
      addBadgesToCard(card, badges);
      console.log(`[Badge Scanner] ✓ Added ${badges.length} badges to job ${jobId}`);
    } else {
      console.log(`[Badge Scanner] No badges to add for job ${jobId}`);
    }
  } else {
    console.log(`[Badge Scanner] ✗ Could not find card for job ${jobId}`);
  }

  // Always update badges in job details panel (right side)
  // This ensures old badges are cleared even when there are no new badges
  await addBadgesToJobDetailsPanel(jobId, badges);

  console.log(`[Badge Scanner] ========================================`);
};

// Find a job card by its job ID
const findJobCardById = (jobId) => {
  console.log(`[Badge Scanner] Looking for card with job ID: ${jobId}`);
  const cards = getJobListingCards();
  console.log(`[Badge Scanner] Total cards found: ${cards.length}`);

  for (const card of cards) {
    const cardJobId = getJobIdFromCard(card);
    console.log(`[Badge Scanner] Checking card with ID: ${cardJobId}`);
    if (cardJobId === jobId) {
      console.log(`[Badge Scanner] ✓ Found matching card!`);
      return card;
    }
  }
  console.log(`[Badge Scanner] ✗ No matching card found for job ID: ${jobId}`);
  return null;
};

// Create loading indicator for job card
const createLoadingIndicator = () => {
  const loader = document.createElement('div');
  loader.className = 'linkedin-job-badge-loader';
  loader.innerHTML = `
    <span style="
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: #f3f6f8;
      border-radius: 10px;
      font-size: 11px;
      color: #666;
    ">
      <svg width="12" height="12" viewBox="0 0 12 12" style="animation: spin 1s linear infinite;">
        <circle cx="6" cy="6" r="5" fill="none" stroke="#0073b1" stroke-width="2" stroke-dasharray="20 10"/>
      </svg>
      Analyzing...
    </span>
  `;

  // Add keyframe animation
  if (!document.getElementById('badge-loader-animation')) {
    const style = document.createElement('style');
    style.id = 'badge-loader-animation';
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  return loader;
};

// Create and inject badge element into job card
const createBadge = (text, color, isVisa = false) => {
  const badge = document.createElement('span');
  badge.className = 'linkedin-job-badge';
  badge.textContent = text;
  badge.style.cssText = `
    display: inline-block;
    background: ${color};
    color: white;
    padding: 2px 8px;
    margin: 2px 4px 2px 0;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  `;

  // Note: color is already set correctly from the badge data
  // isVisa badges should have color #f44336 (red) passed in
  // No need to override here

  return badge;
};

// Show loading indicator on a job card
const showLoadingIndicator = (card) => {
  // Remove existing badges/loaders
  const existing = card.querySelectorAll('.linkedin-job-badge-container, .linkedin-job-badge-loader');
  existing.forEach(el => el.remove());

  const loader = createLoadingIndicator();

  // Based on actual HTML structure:
  // Insert after .artdeco-entity-lockup__metadata (salary info) or .artdeco-entity-lockup__caption (location)
  const insertionPoints = [
    { element: card.querySelector('.artdeco-entity-lockup__metadata'), method: 'after' },
    { element: card.querySelector('.artdeco-entity-lockup__caption'), method: 'after' },
    { element: card.querySelector('.artdeco-entity-lockup__content'), method: 'append' },
  ];

  for (const { element, method } of insertionPoints) {
    if (element) {
      if (method === 'after') {
        element.parentNode.insertBefore(loader, element.nextSibling);
        console.log('[Badge Scanner] Loading indicator inserted after:', element.className);
      } else {
        element.appendChild(loader);
        console.log('[Badge Scanner] Loading indicator appended to:', element.className);
      }
      return;
    }
  }

  // Fallback: append to the job card container
  const jobCardContainer = card.querySelector('.job-card-container');
  if (jobCardContainer) {
    jobCardContainer.appendChild(loader);
    console.log('[Badge Scanner] Loading indicator appended to job-card-container');
  } else {
    card.appendChild(loader);
    console.log('[Badge Scanner] Loading indicator appended to card');
  }
};

// Track pending badge updates to prevent duplicates
const pendingBadgeUpdates = new Map();

// Add badges to a job card (including tracking badges)
const addBadgesToCard = async (card, badges) => {
  const jobId = getJobIdFromCard(card);

  if (!jobId) {
    console.log('[Badge Scanner] Cannot add badges - no job ID');
    return;
  }

  // If there's already a pending update for this job, cancel it
  if (pendingBadgeUpdates.has(jobId)) {
    console.log(`[Badge Scanner] Cancelling duplicate badge update for job ${jobId}`);
    return;
  }

  // Mark this job as having a pending update
  pendingBadgeUpdates.set(jobId, true);

  try {
    console.log(`[Badge Scanner] addBadgesToCard called for job ${jobId} with ${badges.length} badges`);

    // Remove existing badges and loaders
    const existing = card.querySelectorAll('.linkedin-job-badge-container, .linkedin-job-badge-loader');
    existing.forEach(el => el.remove());

    // Get tracking data
    let tracking = null;
    if (jobId) {
      tracking = await getJobTrackingFromDB(jobId);
    }

  // Combine regular badges with tracking badges
  const allBadges = [...badges];

  // Add tracking badges
  if (tracking) {
    if (tracking.appliedAt) {
      // Applied badge takes precedence
      allBadges.unshift({ text: '✅ Applied', color: '#9C27B0', isTracking: true }); // Purple
    } else if (tracking.viewedAt) {
      // Viewed badge
      allBadges.unshift({ text: '👁️ Viewed', color: '#2196F3', isTracking: true }); // Blue
    }
  }

  if (allBadges.length === 0) {
    console.log('[Badge Scanner] No badges to add');
    return;
  }

  // Create badge container
  const badgeContainer = document.createElement('div');
  badgeContainer.className = 'linkedin-job-badge-container';
  badgeContainer.style.cssText = `
    margin-top: 4px;
    margin-bottom: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  `;

  // Add all badges
  allBadges.forEach(({ text, color, isVisa, isTracking }) => {
    const badge = createBadge(text, color, isVisa || isTracking);
    badgeContainer.appendChild(badge);
    console.log('[Badge Scanner] Created badge:', text, color);
  });

  // Based on actual HTML structure:
  // Insert after .artdeco-entity-lockup__metadata (salary info) or .artdeco-entity-lockup__caption (location)
  // This places badges below the location/salary, which is a good visible spot

  console.log('[Badge Scanner] Looking for insertion points in card...');
  const metadata = card.querySelector('.artdeco-entity-lockup__metadata');
  const caption = card.querySelector('.artdeco-entity-lockup__caption');
  const content = card.querySelector('.artdeco-entity-lockup__content');

  console.log('[Badge Scanner] Found metadata:', !!metadata);
  console.log('[Badge Scanner] Found caption:', !!caption);
  console.log('[Badge Scanner] Found content:', !!content);

  const insertionPoints = [
    { element: metadata, method: 'after', name: 'metadata' },
    { element: caption, method: 'after', name: 'caption' },
    { element: content, method: 'append', name: 'content' },
  ];

  for (const { element, method, name } of insertionPoints) {
    if (element) {
      if (method === 'after') {
        element.parentNode.insertBefore(badgeContainer, element.nextSibling);
        console.log(`[Badge Scanner] ✓ Badges inserted after ${name}:`, element.className);
      } else {
        element.appendChild(badgeContainer);
        console.log(`[Badge Scanner] ✓ Badges appended to ${name}:`, element.className);
      }
      console.log('[Badge Scanner] Badge container HTML:', badgeContainer.outerHTML);
      return;
    }
  }

  // Fallback: append to the job card container
  console.log('[Badge Scanner] ⚠️ No insertion points found, using fallback...');
  const jobCardContainer = card.querySelector('.job-card-container');
  if (jobCardContainer) {
    jobCardContainer.appendChild(badgeContainer);
    console.log('[Badge Scanner] Badges appended to job-card-container');
  } else {
    card.appendChild(badgeContainer);
    console.log('[Badge Scanner] Badges appended to card');
  }
  } finally {
    // Clear the pending flag
    pendingBadgeUpdates.delete(jobId);
  }
};

// Fetch job description by temporarily clicking the job card
const fetchJobDescriptionInBackground = async (card, jobId) => {
  return new Promise((resolve) => {
    console.log(`[Badge Scanner] Fetching description for job ${jobId}...`);

    // Store the currently viewed job
    const previousJobId = currentJobId;
    const previousJobText = lastJobText;

    // Set up a listener for the job details to load
    let checkCount = 0;
    const maxChecks = 30; // 3 seconds max

    const checkInterval = setInterval(() => {
      checkCount++;

      // Check if the job details have loaded for this job
      const url = window.location.href;
      const urlHasJobId = url.includes(jobId);

      if (urlHasJobId && lastJobText && lastJobText !== previousJobText) {
        clearInterval(checkInterval);
        console.log(`[Badge Scanner] ✓ Got description for job ${jobId}`);
        resolve(lastJobText);
      } else if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        console.log(`[Badge Scanner] ✗ Timeout fetching description for job ${jobId}`);
        resolve(null);
      }
    }, 100);

    // Click the job card to load its details
    // Based on actual HTML: a.job-card-container__link is the main clickable link
    const clickTarget = card.querySelector('a.job-card-container__link') ||
                       card.querySelector('.job-card-container--clickable') ||
                       card.querySelector('a[href*="/jobs/view/"]') ||
                       card;

    console.log(`[Badge Scanner] Clicking job card for ${jobId}...`, clickTarget);
    clickTarget.click();
  });
};

// Helper function to get job cache from IndexedDB
const getJobCacheFromDB = async (jobId) => {
  try {
    if (!chrome.runtime?.id) {
      return null;
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GET_JOB_CACHE', jobId },
        (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            resolve(null);
          } else {
            resolve(response.cache);
          }
        }
      );
    });
  } catch (error) {
    return null;
  }
};

// Helper function to set job cache in IndexedDB
const setJobCacheInDB = async (jobId, cacheData) => {
  try {
    if (!chrome.runtime?.id) {
      return false;
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'SET_JOB_CACHE', jobId, cacheData },
        (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    });
  } catch (error) {
    return false;
  }
};

// Helper function to get job tracking from IndexedDB
const getJobTrackingFromDB = async (jobId) => {
  try {
    if (!chrome.runtime?.id) {
      return null;
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GET_JOB_TRACKING', jobId },
        (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            resolve(null);
          } else {
            resolve(response.tracking);
          }
        }
      );
    });
  } catch (error) {
    return null;
  }
};

// Helper function to set job tracking in IndexedDB
const setJobTrackingInDB = async (jobId, trackingData) => {
  try {
    if (!chrome.runtime?.id) {
      return false;
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'SET_JOB_TRACKING', jobId, trackingData },
        (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    });
  } catch (error) {
    return false;
  }
};

// Scan and analyze a single job card in the background
const scanJobCardInBackground = async (card, forceRescan = false) => {
  const jobId = getJobIdFromCard(card);

  if (!jobId) {
    console.log('[Badge Scanner] Could not extract job ID from card');
    return;
  }

  // Check memory cache first
  if (!forceRescan && scannedJobs.has(jobId)) {
    console.log(`[Badge Scanner] Job ${jobId} in memory cache`);
    const badges = scannedJobs.get(jobId);
    if (badges && badges.length > 0) {
      addBadgesToCard(card, badges);
    }
    return;
  }

  // Check IndexedDB cache
  if (!forceRescan) {
    const cache = await getJobCacheFromDB(jobId);
    if (cache && cache.badges) {
      const cacheAge = Date.now() - cache.timestamp;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (cacheAge < maxAge) {
        console.log(`[Badge Scanner] Job ${jobId} found in IndexedDB cache (${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days old)`);
        scannedJobs.set(jobId, cache.badges);
        if (cache.badges.length > 0) {
          addBadgesToCard(card, cache.badges);
        }
        return;
      } else {
        console.log(`[Badge Scanner] Job ${jobId} cache expired, re-scanning`);
      }
    }
  }

  console.log(`[Badge Scanner] Starting ${forceRescan ? 'forced ' : ''}scan for job ${jobId}...`);

  // Show loading indicator
  showLoadingIndicator(card);

  // Extract company name and job title from the card
  const companyName = getCompanyNameFromCard(card);
  const jobTitle = card.querySelector('.job-card-list__title')?.textContent?.trim() || '';
  console.log(`[Badge Scanner] Company: "${companyName}", Title: "${jobTitle}"`);

  // Fetch job description
  const jobDescription = await fetchJobDescriptionInBackground(card, jobId);

  if (!jobDescription) {
    console.log(`[Badge Scanner] Could not fetch description for job ${jobId}`);
    // Remove loading indicator
    const loader = card.querySelector('.linkedin-job-badge-loader');
    if (loader) loader.remove();
    return;
  }

  // Analyze job description
  const badges = [];

  // Check visa sponsorship
  if (badgeSettings.visaBadgeEnabled) {
    const visaResult = await checkVisaSponsorship(jobDescription, companyName);
    if (visaResult.found) {
      // Always show "✓ Visa" without percentage on badges
      // Detailed match info will be shown in side panel
      badges.push({
        text: '✓ Visa',
        color: '#f44336',
        isVisa: true,
        confidence: visaResult.confidence,
        matchedName: visaResult.matchedName,
        allMatches: visaResult.allMatches || [] // Store all matches for side panel
      });
    }
  }

  // Check keywords
  const foundKeywords = checkKeywordsInJob(jobDescription, badgeSettings.keywords);
  foundKeywords.forEach(({ keyword, color }) => {
    badges.push({ text: keyword, color, isVisa: false });
  });

  // Store in memory cache
  scannedJobs.set(jobId, badges);

  // Store in IndexedDB cache
  await setJobCacheInDB(jobId, {
    badges,
    companyName,
    jobTitle,
    scannedAt: Date.now()
  });

  // Add badges to card (this will remove the loading indicator)
  if (badges.length > 0) {
    addBadgesToCard(card, badges);
    console.log(`[Badge Scanner] ✓ Added ${badges.length} badges to job ${jobId}`);
  } else {
    // Remove loading indicator if no badges
    const loader = card.querySelector('.linkedin-job-badge-loader');
    if (loader) loader.remove();
    console.log(`[Badge Scanner] No badges for job ${jobId}`);
  }
};

// Update badges for a job card (using cached data if available)
const updateJobCardBadges = (card) => {
  const jobId = getJobIdFromCard(card);

  if (!jobId) {
    return;
  }

  // Check if we have cached badge data for this job
  if (scannedJobs.has(jobId)) {
    const badges = scannedJobs.get(jobId);
    if (badges && badges.length > 0) {
      addBadgesToCard(card, badges);
    }
  }
};

// Scan all visible job cards in the background
const scanAllJobCardsInBackground = async () => {
  console.log('[Badge Scanner] ========================================');
  console.log('[Badge Scanner] scanAllJobCardsInBackground() called');
  console.log('[Badge Scanner] ========================================');

  if (!badgeSettings || !badgeSettings.enabled) {
    console.log('[Badge Scanner] ⚠️ Badge scanner is disabled in settings');
    console.log('[Badge Scanner] badgeSettings:', badgeSettings);
    return;
  }

  console.log('[Badge Scanner] ✓ Badge scanner is enabled');

  const cards = getJobListingCards();

  if (cards.length === 0) {
    console.log('[Badge Scanner] ⚠️ No job cards found to scan - page may not be loaded yet');
    return;
  }

  console.log(`[Badge Scanner] ✓ Starting background scan of ${cards.length} job cards...`);

  // Scan cards one by one with a delay to avoid overwhelming the page
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    console.log(`[Badge Scanner] 🔍 Processing card ${i + 1}/${cards.length}`);
    await scanJobCardInBackground(card);

    // Add delay between scans (1.5 seconds to allow job details to load)
    if (i < cards.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  console.log('[Badge Scanner] ========================================');
  console.log('[Badge Scanner] ✓ Background scan complete');
  console.log('[Badge Scanner] ========================================');
};

// Update badges for all visible job cards (using cached data)
const updateAllJobCardBadges = () => {
  if (!badgeSettings || !badgeSettings.enabled) {
    return;
  }

  const cards = getJobListingCards();

  if (cards.length === 0) {
    return;
  }

  console.log(`[Badge Scanner] Updating badges for ${cards.length} job cards...`);

  // Update badges for all cards
  cards.forEach(card => {
    updateJobCardBadges(card);
  });
};

// Initialize badge scanner
const initBadgeScanner = async () => {
  if (badgeScannerActive) return;

  console.log('[Badge Scanner] Initializing badge scanner...');

  // Load settings
  await loadBadgeSettings();

  if (!badgeSettings.enabled) {
    console.log('[Badge Scanner] Badge scanner is disabled in settings');
    return;
  }

  badgeScannerActive = true;

  // Start automatic background scanning after a delay
  setTimeout(() => {
    console.log('[Badge Scanner] Starting automatic background scan...');
    scanAllJobCardsInBackground();
  }, 2000);

  // Set up observer for new job cards
  const jobListObserver = new MutationObserver((mutations) => {
    // Check if new job cards were added
    const hasNewCards = mutations.some(mutation => {
      return Array.from(mutation.addedNodes).some(node => {
        if (node.nodeType === 1) { // Element node
          return node.matches?.('.jobs-search-results__list-item, .scaffold-layout__list-item') ||
                 node.querySelector?.('.jobs-search-results__list-item, .scaffold-layout__list-item');
        }
        return false;
      });
    });

    if (hasNewCards) {
      console.log('[Badge Scanner] New job cards detected, starting background scan...');
      setTimeout(() => scanAllJobCardsInBackground(), 1000);
    }
  });

  // Observe the job list container
  // Based on actual HTML: .scaffold-layout__list contains the ul with job cards
  const jobListContainer = document.querySelector('.scaffold-layout__list');
  if (jobListContainer) {
    jobListObserver.observe(jobListContainer, {
      childList: true,
      subtree: true
    });
    console.log('[Badge Scanner] Observer set up for job list container');
  } else {
    console.log('[Badge Scanner] Could not find job list container');
  }

  // Listen for scroll events to scan newly visible cards
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (badgeSettings && badgeSettings.enabled) {
        // First update cached badges, then scan new ones
        updateAllJobCardBadges();
        // Scan any new cards that don't have badges yet
        setTimeout(() => scanAllJobCardsInBackground(), 500);
      }
    }, 1000);
  }, { passive: true });

  console.log('[Badge Scanner] Badge scanner initialized');
};

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.ENABLE_BADGE_SCANNER || changes.ENABLE_VISA_BADGE || changes.BADGE_KEYWORDS) {
      console.log('[Badge Scanner] Settings changed, reloading...');
      loadBadgeSettings().then(async () => {
        // Clear scanned jobs to rescan with new settings
        scannedJobs.clear();

        // Re-analyze current job if one is open
        if (currentJobId && lastJobText && badgeSettings && badgeSettings.enabled) {
          await analyzeCurrentJobAndUpdateBadges(currentJobId, lastJobText);
        }

        // Rescan all visible job cards with new settings
        if (badgeSettings && badgeSettings.enabled) {
          scanAllJobCardsInBackground();
        }
      });
    }
  }
});

// Load badge settings immediately on script load
loadBadgeSettings().then(() => {
  console.log('[Badge Scanner] Initial settings loaded on page load');
});

// Find the actual scrollable container for the job list
const findScrollableJobListContainer = () => {
  console.log('[Badge Scanner] Looking for scrollable job list container...');

  // Strategy 1: Try to find the .scaffold-layout__list element
  const jobList = document.querySelector('.scaffold-layout__list');
  if (!jobList) {
    console.log('[Badge Scanner] ⚠️ .scaffold-layout__list not found');
    return null;
  }

  console.log(`[Badge Scanner] Found .scaffold-layout__list - scrollHeight: ${jobList.scrollHeight}, clientHeight: ${jobList.clientHeight}`);

  // Check if the job list itself is scrollable
  if (jobList.scrollHeight > jobList.clientHeight) {
    console.log('[Badge Scanner] ✓ .scaffold-layout__list is scrollable');
    return jobList;
  }

  // Strategy 2: Find the scrollable parent by traversing up the DOM
  console.log('[Badge Scanner] .scaffold-layout__list is not scrollable, searching for scrollable parent...');
  let element = jobList;
  let depth = 0;

  while (element && element !== document.body && depth < 10) {
    element = element.parentElement;
    depth++;

    if (!element) break;

    const style = window.getComputedStyle(element);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    const isScrollable = element.scrollHeight > element.clientHeight;

    console.log(`[Badge Scanner] Checking parent ${depth}: ${element.tagName}.${element.className.substring(0, 30)} - overflow: ${overflowY}, scrollable: ${isScrollable}`);

    if ((overflowY === 'auto' || overflowY === 'scroll') && isScrollable) {
      console.log(`[Badge Scanner] ✓ Found scrollable parent at depth ${depth}: ${element.className.substring(0, 50)}`);
      console.log(`[Badge Scanner] Container details - scrollHeight: ${element.scrollHeight}, clientHeight: ${element.clientHeight}`);
      return element;
    }
  }

  // Strategy 3: Search for any scrollable element that contains job cards
  console.log('[Badge Scanner] Parent traversal failed, searching for any scrollable container with job cards...');
  const allElements = document.querySelectorAll('*');
  let bestMatch = null;
  let maxJobCards = 0;

  for (const el of allElements) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const isScrollable = el.scrollHeight > el.clientHeight;

    if ((overflowY === 'auto' || overflowY === 'scroll') && isScrollable) {
      const jobCardCount = el.querySelectorAll('li[data-occludable-job-id]').length;

      if (jobCardCount > maxJobCards) {
        maxJobCards = jobCardCount;
        bestMatch = el;
      }
    }
  }

  if (bestMatch) {
    console.log(`[Badge Scanner] ✓ Found scrollable container via exhaustive search: ${bestMatch.className.substring(0, 50)}`);
    console.log(`[Badge Scanner] Container has ${maxJobCards} job cards`);
    console.log(`[Badge Scanner] Container details - scrollHeight: ${bestMatch.scrollHeight}, clientHeight: ${bestMatch.clientHeight}`);
    return bestMatch;
  }

  console.log('[Badge Scanner] ❌ No scrollable container found after exhaustive search');
  return null;
};

// Auto-scroll job list to load all jobs with retry logic
const autoScrollJobList = async () => {
  console.log('[Badge Scanner] ========================================');
  console.log('[Badge Scanner] Starting auto-scroll to load all jobs...');
  console.log('[Badge Scanner] ========================================');

  // Retry logic: try to find the scrollable container multiple times
  let jobListContainer = null;
  const maxRetries = 5;

  for (let retry = 0; retry < maxRetries; retry++) {
    console.log(`[Badge Scanner] Attempt ${retry + 1}/${maxRetries} to find scrollable container...`);

    jobListContainer = findScrollableJobListContainer();

    if (jobListContainer) {
      console.log(`[Badge Scanner] ✓ Found scrollable container on attempt ${retry + 1}`);
      break;
    }

    if (retry < maxRetries - 1) {
      console.log(`[Badge Scanner] Container not found, waiting 1 second before retry...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!jobListContainer) {
    console.log('[Badge Scanner] ❌ Failed to find scrollable container after all retries');
    console.log('[Badge Scanner] This may be due to:');
    console.log('[Badge Scanner]   1. LinkedIn changed their HTML structure');
    console.log('[Badge Scanner]   2. Page is still loading');
    console.log('[Badge Scanner]   3. User is not on a jobs page');
    return;
  }

  const initialScrollHeight = jobListContainer.scrollHeight;
  const clientHeight = jobListContainer.clientHeight;
  const initialJobCount = jobListContainer.querySelectorAll('li[data-occludable-job-id]').length;

  console.log(`[Badge Scanner] Container metrics:`);
  console.log(`[Badge Scanner]   - scrollHeight: ${initialScrollHeight}px`);
  console.log(`[Badge Scanner]   - clientHeight: ${clientHeight}px`);
  console.log(`[Badge Scanner]   - Initial job count: ${initialJobCount}`);

  // Check if scrolling is even needed
  if (initialScrollHeight <= clientHeight) {
    console.log('[Badge Scanner] ⚠️ All jobs already visible, no scrolling needed');
    return;
  }

  console.log('[Badge Scanner] Starting scroll sequence...');

  // Keep scrolling until we reach the bottom and no new content loads
  let scrollAttempts = 0;
  const maxScrollAttempts = 50; // Prevent infinite loops
  let previousScrollHeight = initialScrollHeight;

  while (scrollAttempts < maxScrollAttempts) {
    // Scroll to bottom
    const targetScroll = jobListContainer.scrollHeight;
    jobListContainer.scrollTop = targetScroll;

    const actualScroll = jobListContainer.scrollTop;
    console.log(`[Badge Scanner] Scroll ${scrollAttempts + 1}: target=${targetScroll}px, actual=${actualScroll}px`);

    // Wait for jobs to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if new content was loaded
    const currentScrollHeight = jobListContainer.scrollHeight;
    const currentJobCount = jobListContainer.querySelectorAll('li[data-occludable-job-id]').length;

    if (currentScrollHeight > previousScrollHeight) {
      console.log(`[Badge Scanner] ✓ New content loaded: ${previousScrollHeight}px → ${currentScrollHeight}px (${currentJobCount} jobs)`);
      previousScrollHeight = currentScrollHeight;
      scrollAttempts = 0; // Reset attempts counter when new content loads
    } else {
      scrollAttempts++;
      console.log(`[Badge Scanner] No new content (attempt ${scrollAttempts}/3)`);

      // If we've tried 3 times and no new content, we're done
      if (scrollAttempts >= 3) {
        console.log('[Badge Scanner] ✓ Reached end of job list');
        break;
      }
    }
  }

  const finalJobCount = jobListContainer.querySelectorAll('li[data-occludable-job-id]').length;
  console.log(`[Badge Scanner] ========================================`);
  console.log(`[Badge Scanner] Scroll complete:`);
  console.log(`[Badge Scanner]   - Initial jobs: ${initialJobCount}`);
  console.log(`[Badge Scanner]   - Final jobs: ${finalJobCount}`);
  console.log(`[Badge Scanner]   - Jobs loaded: ${finalJobCount - initialJobCount}`);
  console.log(`[Badge Scanner] ========================================`);

  // Scroll back to top
  jobListContainer.scrollTop = 0;
  console.log('[Badge Scanner] ✓ Scrolled back to top');

  // Wait a moment for the scroll to complete
  await new Promise(resolve => setTimeout(resolve, 500));
};

// Add badges to job details panel (right side)
const addBadgesToJobDetailsPanel = async (jobId, badges) => {
  console.log(`[Badge Scanner] Adding badges to job details panel for job ${jobId} (${badges.length} badges)`);

  // Remove existing badge container if present
  const existingContainer = document.querySelector('.linkedin-job-badges-details');
  if (existingContainer) {
    existingContainer.remove();
    console.log('[Badge Scanner] Removed existing badge container');
  }

  // If no badges, just return after clearing
  if (badges.length === 0) {
    console.log('[Badge Scanner] No badges to add, container cleared');
    return;
  }

  // Find the primary description container
  const primaryDescContainer = document.querySelector('.job-details-jobs-unified-top-card__primary-description-container');
  if (!primaryDescContainer) {
    console.log('[Badge Scanner] Primary description container not found');
    return;
  }

  // Create badge container
  const badgeContainer = document.createElement('div');
  badgeContainer.className = 'linkedin-job-badges-details';
  badgeContainer.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
    margin-bottom: 12px;
    padding: 12px;
    background-color: #f3f6f8;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
  `;

  // Add badges
  badges.forEach(badge => {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'linkedin-job-badge-details';
    badgeEl.textContent = badge.text;
    badgeEl.style.cssText = `
      display: inline-block;
      padding: 6px 12px;
      background-color: ${badge.color};
      color: white;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    badgeContainer.appendChild(badgeEl);
  });

  // Insert AFTER the primary description container
  // Look for the next sibling that matches our target elements
  const targetSelectors = [
    '.job-details-fit-level-preferences',
    '.display-flex'
  ];

  let insertionPoint = null;
  for (const selector of targetSelectors) {
    const element = primaryDescContainer.parentElement.querySelector(selector);
    if (element) {
      insertionPoint = element;
      console.log(`[Badge Scanner] Found insertion point: ${selector}`);
      break;
    }
  }

  if (insertionPoint) {
    // Insert before the target element
    insertionPoint.parentNode.insertBefore(badgeContainer, insertionPoint);
    console.log(`[Badge Scanner] ✓ Added ${badges.length} badges before ${insertionPoint.className}`);
  } else {
    // Fallback: insert after primary description container
    primaryDescContainer.parentNode.insertBefore(badgeContainer, primaryDescContainer.nextSibling);
    console.log(`[Badge Scanner] ✓ Added ${badges.length} badges after primary description container (fallback)`);
  }
};

// ============================================
// KEYWORD HIGHLIGHTING ON LINKEDIN PAGE
// ============================================

// Helper function to escape regex special characters
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Helper function to create a text node walker
const createTextNodeWalker = (root) => {
  return document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip if parent is already a highlight mark
        if (node.parentElement?.tagName === 'MARK' && node.parentElement?.classList.contains('linkedin-keyword-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip if parent is a script or style tag
        if (node.parentElement?.tagName === 'SCRIPT' || node.parentElement?.tagName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        // Only accept text nodes with actual content
        if (node.textContent.trim().length > 0) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );
};

// Highlight keywords in the LinkedIn job description
const highlightKeywordsOnPage = async () => {
  console.log('[Keyword Highlighter] Starting keyword highlighting on LinkedIn page...');

  // Find the job description container
  const jobDescContainer = document.querySelector('.jobs-description__content') ||
                           document.querySelector('.jobs-box__html-content') ||
                           document.querySelector('.jobs-description') ||
                           document.querySelector('article.jobs-description__container');

  if (!jobDescContainer) {
    console.log('[Keyword Highlighter] Job description container not found');
    return;
  }

  // Remove any existing highlights
  const existingHighlights = jobDescContainer.querySelectorAll('mark.linkedin-keyword-highlight');
  existingHighlights.forEach(mark => {
    const parent = mark.parentNode;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize(); // Merge adjacent text nodes
  });

  // Get all keyword settings
  const settings = await chrome.storage.local.get([
    'ENABLE_BADGE_SCANNER',
    'ENABLE_VISA_BADGE',
    'BADGE_KEYWORDS',
    'SEARCH_KEYWORDS',
    'BAD_KEYWORDS'
  ]);

  // Collect all keywords to highlight with their colors
  const keywordsToHighlight = [];

  // Add custom badge keywords
  if (settings.BADGE_KEYWORDS) {
    const lines = settings.BADGE_KEYWORDS.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        const parts = trimmed.split('|');
        const keyword = parts[0]?.trim();
        const color = parts[1]?.trim() || '#2196f3';
        if (keyword) {
          keywordsToHighlight.push({ keyword, color, priority: 3 });
        }
      }
    }
  }

  // Add visa sponsorship keywords if enabled
  if (settings.ENABLE_VISA_BADGE !== false) {
    const visaKeywords = [
      'visa sponsorship',
      'visa sponsor',
      'sponsorship available',
      'will sponsor',
      'can sponsor',
      'sponsorship provided',
      'h1b',
      'h-1b',
      'work authorization',
      'right to work'
    ];
    visaKeywords.forEach(keyword => {
      keywordsToHighlight.push({ keyword, color: '#f44336', priority: 4 }); // Red for visa keywords
    });
  }

  // Add search keywords (good keywords) in green
  if (settings.SEARCH_KEYWORDS && settings.SEARCH_KEYWORDS.trim()) {
    const searchKeywordList = settings.SEARCH_KEYWORDS.split(',').map(k => k.trim()).filter(k => k);
    searchKeywordList.forEach(keyword => {
      keywordsToHighlight.push({ keyword, color: '#4caf50', priority: 2 }); // Green for good keywords
    });
  }

  // Add bad keywords in orange
  if (settings.BAD_KEYWORDS && settings.BAD_KEYWORDS.trim()) {
    const badKeywordList = settings.BAD_KEYWORDS.split(',').map(k => k.trim()).filter(k => k);
    badKeywordList.forEach(keyword => {
      keywordsToHighlight.push({ keyword, color: '#ff9800', priority: 1 }); // Orange for bad keywords
    });
  }

  if (keywordsToHighlight.length === 0) {
    console.log('[Keyword Highlighter] No keywords to highlight');
    return;
  }

  // Sort keywords by length (longest first) to avoid partial matches
  keywordsToHighlight.sort((a, b) => b.keyword.length - a.keyword.length);

  console.log(`[Keyword Highlighter] Highlighting ${keywordsToHighlight.length} keywords`);

  // Apply highlights
  const walker = createTextNodeWalker(jobDescContainer);
  const nodesToProcess = [];

  let node;
  while (node = walker.nextNode()) {
    nodesToProcess.push(node);
  }

  for (const textNode of nodesToProcess) {
    let text = textNode.textContent;
    let hasMatch = false;
    const fragments = [];
    let lastIndex = 0;

    // Find all matches in this text node
    const matches = [];
    for (const { keyword, color, priority } of keywordsToHighlight) {
      const regex = new RegExp(escapeRegex(keyword), 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          color,
          priority
        });
      }
    }

    if (matches.length === 0) continue;

    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);

    // Remove overlapping matches (keep higher priority)
    const filteredMatches = [];
    for (const match of matches) {
      const overlaps = filteredMatches.some(existing =>
        (match.start >= existing.start && match.start < existing.end) ||
        (match.end > existing.start && match.end <= existing.end)
      );
      if (!overlaps) {
        filteredMatches.push(match);
      }
    }

    // Create document fragments with highlights
    for (const match of filteredMatches) {
      // Add text before match
      if (match.start > lastIndex) {
        fragments.push(document.createTextNode(text.substring(lastIndex, match.start)));
      }

      // Add highlighted match
      const mark = document.createElement('mark');
      mark.className = 'linkedin-keyword-highlight';
      mark.style.cssText = `
        background-color: ${match.color};
        color: white;
        padding: 2px 4px;
        border-radius: 3px;
        font-weight: 600;
      `;
      mark.textContent = match.text;
      fragments.push(mark);

      lastIndex = match.end;
      hasMatch = true;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      fragments.push(document.createTextNode(text.substring(lastIndex)));
    }

    // Replace the text node with fragments
    if (hasMatch) {
      const parent = textNode.parentNode;
      const nextSibling = textNode.nextSibling;
      parent.removeChild(textNode);
      fragments.forEach(fragment => {
        parent.insertBefore(fragment, nextSibling);
      });
    }
  }

  console.log('[Keyword Highlighter] ✓ Keyword highlighting complete');
};

// Initialize badge scanner after main init
// Wait for page to fully load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
      console.log('[Badge Scanner] Page loaded, initializing...');
      initBadgeScanner();

      // Auto-scroll to load all jobs after initialization
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for initial load
      await autoScrollJobList();

      // Scan all jobs after scrolling
      if (badgeSettings && badgeSettings.enabled) {
        console.log('[Badge Scanner] Starting full scan after auto-scroll...');
        scanAllJobCardsInBackground();
      }
    }, 2000);
  });
} else {
  setTimeout(async () => {
    console.log('[Badge Scanner] Page already loaded, initializing...');
    initBadgeScanner();

    // Auto-scroll to load all jobs after initialization
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for initial load
    await autoScrollJobList();

    // Scan all jobs after scrolling
    if (badgeSettings && badgeSettings.enabled) {
      console.log('[Badge Scanner] Starting full scan after auto-scroll...');
      scanAllJobCardsInBackground();
    }
  }, 2000);
}


