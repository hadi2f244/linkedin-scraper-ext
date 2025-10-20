# Badge Scanner Debugging Guide

## How to Test the Extension

### 1. Reload the Extension
1. Go to `chrome://extensions/`
2. Find "LinkedIn Job Scraper"
3. Click the reload icon (🔄)

### 2. Open LinkedIn Jobs Page
Navigate to: `https://www.linkedin.com/jobs/collections/recommended/`

### 3. Open DevTools Console
Press `F12` or right-click → "Inspect" → "Console" tab

## Expected Console Output

### On Page Load (after 2 seconds):
```
[Badge Scanner] Page already loaded, initializing...
[Badge Scanner] Initializing badge scanner...
[Badge Scanner] Loading badge settings...
[Badge Scanner] Settings loaded: {enabled: true, visaBadgeEnabled: true, keywords: [...]}
[Badge Scanner] ✓ Badge scanner is enabled
[Badge Scanner] Starting automatic background scan...
```

### During Scanning:
```
[Badge Scanner] ========================================
[Badge Scanner] scanAllJobCardsInBackground() called
[Badge Scanner] ========================================
[Badge Scanner] ✓ Badge scanner is enabled
[Badge Scanner] getJobListingCards() called
[Badge Scanner] Selector: li.scaffold-layout__list-item[data-occludable-job-id]
[Badge Scanner] Found 20 job cards
[Badge Scanner] First card: <li id="ember117" class="...">
[Badge Scanner] First card job ID: 4306214894
[Badge Scanner] ✓ Starting background scan of 20 job cards...
[Badge Scanner] 🔍 Processing card 1/20
[Badge Scanner] Extracted job ID from data attribute: 4306214894
[Badge Scanner] Showing loading indicator for job 4306214894
[Badge Scanner] Loading indicator inserted after: artdeco-entity-lockup__metadata
[Badge Scanner] Clicking job card for 4306214894...
[Badge Scanner] Waiting for job description to load...
[Badge Scanner] Job description loaded, analyzing...
[Badge Scanner] Looking for insertion points in card...
[Badge Scanner] Found metadata: true
[Badge Scanner] Found caption: true
[Badge Scanner] Found content: true
[Badge Scanner] ✓ Badges inserted after metadata: ...
[Badge Scanner] Badge container HTML: <div class="linkedin-job-badge-container">...</div>
```

### If Badges Are Created:
```
[Badge Scanner] ✓ Added 2 badges to job 4306214894
```

### If No Badges:
```
[Badge Scanner] No badges for job 4306214894
```

## Troubleshooting

### Problem 1: "No job cards found"
**Console shows:**
```
[Badge Scanner] Found 0 job cards
[Badge Scanner] ⚠️ No job cards found! Checking if page structure exists...
[Badge Scanner] List container exists: false
```

**Solution:**
- The page hasn't loaded yet
- Wait a few more seconds and check console again
- Try refreshing the page
- Make sure you're on the jobs page, not the job details page

### Problem 2: "Badge scanner is disabled"
**Console shows:**
```
[Badge Scanner] ⚠️ Badge scanner is disabled in settings
[Badge Scanner] badgeSettings: {enabled: false, ...}
```

**Solution:**
1. Click the extension icon in Chrome toolbar
2. Click "Options"
3. Check "Enable automatic badge scanning on job listings"
4. Click "Save Settings"
5. Refresh the LinkedIn page

### Problem 3: "No insertion points found"
**Console shows:**
```
[Badge Scanner] Found metadata: false
[Badge Scanner] Found caption: false
[Badge Scanner] Found content: false
[Badge Scanner] ⚠️ No insertion points found, using fallback...
```

**Solution:**
- LinkedIn may have changed their HTML structure
- Check the actual HTML in DevTools Elements tab
- Look for elements with classes: `.artdeco-entity-lockup__metadata`, `.artdeco-entity-lockup__caption`

### Problem 4: Badges not visible
**Console shows badges were inserted but you don't see them:**

**Solution:**
1. Check if badges have CSS styling:
   - Open DevTools Elements tab
   - Find `.linkedin-job-badge-container`
   - Check if it has `display: flex` and proper styling
   
2. Check if badges are hidden behind other elements:
   - Look for `z-index` issues
   - Check if parent elements have `overflow: hidden`

3. Inspect the badge HTML:
   - Should see: `<div class="linkedin-job-badge-container">...</div>`
   - Inside should be: `<span class="linkedin-job-badge">...</span>`

## Manual Testing Commands

You can run these in the DevTools console to test manually:

### Check if job cards exist:
```javascript
document.querySelectorAll('li.scaffold-layout__list-item[data-occludable-job-id]').length
```

### Get first job ID:
```javascript
document.querySelector('li.scaffold-layout__list-item[data-occludable-job-id]').getAttribute('data-occludable-job-id')
```

### Check if badge settings are loaded:
```javascript
chrome.storage.local.get(['ENABLE_BADGE_SCANNER', 'ENABLE_VISA_BADGE', 'BADGE_KEYWORDS'], (result) => {
  console.log('Settings:', result);
});
```

### Force a scan:
```javascript
// This won't work directly because functions are in content script scope
// But you can reload the extension to trigger a new scan
```

## Success Indicators

✅ **Everything is working if you see:**
1. Console shows: `Found X job cards` (where X > 0)
2. Console shows: `✓ Badge scanner is enabled`
3. Console shows: `✓ Badges inserted after metadata`
4. Badges appear on job cards below the salary/location info
5. Badges have proper styling (colored background, white text)

## Common Issues

### Issue: Extension not loading
- Check `chrome://extensions/` - make sure extension is enabled
- Check for errors in the extension's background page console

### Issue: Settings not saving
- Check extension options page
- Make sure you click "Save Settings"
- Check console for errors

### Issue: Badges appear but disappear
- LinkedIn may be re-rendering the job cards
- The MutationObserver should re-add badges
- Check console for "New job cards detected" messages

## Next Steps

If badges still don't appear after following this guide:
1. Share the complete console output
2. Share a screenshot of the job card HTML (from DevTools Elements tab)
3. Share the extension settings (from Options page)

