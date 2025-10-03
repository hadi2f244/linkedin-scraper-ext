// Content script for LinkedIn job pages
// Monitors job details and sends updates to the side panel

let lastJobText = '';
let observerActive = false;

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
  const jobDetailsEl = document.querySelector('#job-details > div');

  if (!jobDetailsEl) {
    console.log('[LinkedIn Scraper] No job details element found');
    return null;
  }

  const text = jobDetailsEl.innerText || jobDetailsEl.textContent || '';
  const cleaned = normalizeText(text);

  // Only send if the content has changed
  if (cleaned && cleaned !== lastJobText) {
    console.log('[LinkedIn Scraper] New job text detected, length:', cleaned.length);
    lastJobText = cleaned;

    // Wait for company name to load (with timeout)
    console.log('[LinkedIn Scraper] Starting company name extraction...');
    const companyName = await waitForCompanyName(3000);
    console.log('[LinkedIn Scraper] Final company name:', companyName);

    return {
      text: cleaned,
      companyName: companyName
    };
  }

  console.log('[LinkedIn Scraper] Job text unchanged, skipping');
  return null;
};

// Send job data to the side panel
const sendJobDataToSidePanel = (jobData) => {
  chrome.runtime.sendMessage({
    type: 'JOB_DATA_UPDATED',
    data: {
      text: jobData.text,
      companyName: jobData.companyName,
      url: window.location.href,
      timestamp: Date.now()
    }
  }).catch((err) => {
    // Side panel might not be open yet, that's okay
    console.log('Could not send to side panel:', err.message);
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
  setTimeout(checkAndSendJobDetails, 1000);
  
  // Set up observer for future changes
  setupObserver();
  
  // Also check when user scrolls (in case they scroll through job list)
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(checkAndSendJobDetails, 300);
  }, { passive: true });
  
  // Listen for clicks on job listings
  document.addEventListener('click', (e) => {
    // Check if clicked element is or is within a job card
    const jobCard = e.target.closest('.job-card-container, .jobs-search-results__list-item');
    if (jobCard) {
      setTimeout(checkAndSendJobDetails, 500);
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
  if (message.type === 'REQUEST_JOB_DATA') {
    // Handle async extraction
    extractJobDetails().then(jobData => {
      sendResponse({
        success: true,
        data: jobData ? {
          text: jobData.text,
          companyName: jobData.companyName,
          url: window.location.href,
          timestamp: Date.now()
        } : null
      });
    });
    return true; // Keep the message channel open for async response
  }
  return true;
});

