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

// Listen for messages from content script and forward to side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'JOB_DATA_UPDATED') {
    // Forward the message to all side panels
    // The side panel will receive this via chrome.runtime.onMessage
    console.log('Job data updated, forwarding to side panel');
  }
  return true;
});

