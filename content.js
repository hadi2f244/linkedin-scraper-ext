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

// Extract job details from the page
const extractJobDetails = () => {
  const jobDetailsEl = document.querySelector('#job-details > div');
  
  if (!jobDetailsEl) {
    return null;
  }

  const text = jobDetailsEl.innerText || jobDetailsEl.textContent || '';
  const cleaned = normalizeText(text);
  
  // Only send if the content has changed
  if (cleaned && cleaned !== lastJobText) {
    lastJobText = cleaned;
    return cleaned;
  }
  
  return null;
};

// Send job data to the side panel
const sendJobDataToSidePanel = (jobText) => {
  chrome.runtime.sendMessage({
    type: 'JOB_DATA_UPDATED',
    data: {
      text: jobText,
      url: window.location.href,
      timestamp: Date.now()
    }
  }).catch((err) => {
    // Side panel might not be open yet, that's okay
    console.log('Could not send to side panel:', err.message);
  });
};

// Check for job details and send if found
const checkAndSendJobDetails = () => {
  const jobText = extractJobDetails();
  if (jobText) {
    console.log('Job details found, sending to side panel');
    sendJobDataToSidePanel(jobText);
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
    const jobText = extractJobDetails();
    sendResponse({
      success: true,
      data: jobText ? {
        text: jobText,
        url: window.location.href,
        timestamp: Date.now()
      } : null
    });
  }
  return true;
});

