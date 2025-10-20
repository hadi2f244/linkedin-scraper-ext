# Badge Scanner Debugging Guide

## How to Debug the Badge Scanner

### Step 1: Check if Badge Scanner is Enabled

1. Open the extension options page
2. Scroll to "Job Listing Badge Scanner" section
3. Make sure these are checked:
   - ✅ "Enable automatic badge scanning on job listings"
   - ✅ "Show visa sponsorship badge"
4. Add some test keywords:
   ```
   kubernetes|#4caf50
   docker|#2196f3
   python|#ff9800
   ```
5. Click "Save"

### Step 2: Open LinkedIn Jobs and Check Console

1. Go to https://www.linkedin.com/jobs/
2. Open Chrome DevTools (F12 or Right-click → Inspect)
3. Go to the "Console" tab
4. Look for these messages:

**On page load:**
```
[Badge Scanner] Initial settings loaded on page load
[Badge Scanner] Settings loaded: {enabled: true, visaBadgeEnabled: true, keywords: Array(3)}
[Badge Scanner] Initializing badge scanner...
[Badge Scanner] Found X job cards using selector: .scaffold-layout__list-item
```

### Step 3: Watch Automatic Scanning

After the page loads, the extension will automatically start scanning jobs. You should see:

```
[Badge Scanner] Starting automatic background scan...
[Badge Scanner] Starting background scan of 25 job cards...
[Badge Scanner] Starting background scan for job 1234567890...
[Badge Scanner] Fetching description for job 1234567890...
[Badge Scanner] Clicking job card for 1234567890...
[Badge Scanner] ✓ Got description for job 1234567890
[Badge Scanner] ✓ Added 3 badges to job 1234567890
[Badge Scanner] Starting background scan for job 1234567891...
...
[Badge Scanner] Background scan complete
```

**What you'll see in the UI:**
1. Loading indicators appear on each job card (spinning icon with "Analyzing...")
2. As each job is analyzed, the loading indicator is replaced with badges
3. This happens automatically without you clicking on jobs

### Step 4: Check for Badges in the UI

Look at the job cards in the left panel. You should see:
- Loading indicators (spinning icon with "Analyzing...") appear first
- After a few seconds, badges replace the loading indicators
- Small colored badges below the location/company name
- Green "✓ Visa" badge if visa sponsorship is detected
- Colored keyword badges for matching keywords

### Common Issues and Solutions

#### Issue 1: "Badge settings not loaded"
**Solution:** Refresh the page and wait 3 seconds before clicking on jobs

#### Issue 2: "No matching card found for job ID"
**Possible causes:**
- The job card selector doesn't match LinkedIn's current DOM structure
- The job ID extraction is failing

**Debug steps:**
1. In the console, type: `document.querySelectorAll('.scaffold-layout__list-item').length`
2. This should return the number of job cards visible
3. Click on a job card and check the console for the job ID being extracted

#### Issue 3: Badges created but not visible
**Possible causes:**
- Badge insertion point not found
- CSS styling issue

**Debug steps:**
1. Look for the message: "Badges inserted using method: ..."
2. If you see "Using fallback insertion to card", the insertion points aren't matching
3. Inspect a job card element in DevTools and verify the class names match:
   - `.artdeco-entity-lockup__caption`
   - `.artdeco-entity-lockup__subtitle`
   - `.artdeco-entity-lockup__content`

#### Issue 4: No keywords found
**Possible causes:**
- Keywords not configured correctly
- Job description doesn't contain the keywords

**Debug steps:**
1. Check the console for: "Found X matching keywords"
2. If it says "Found 0 matching keywords", the job doesn't contain your keywords
3. Try adding common keywords like "python" or "javascript"

### Manual Testing Commands

Open the console and try these commands:

```javascript
// Check if badge settings are loaded
console.log(badgeSettings);

// Check how many job cards are found
document.querySelectorAll('.scaffold-layout__list-item').length

// Check a specific job card's ID
const card = document.querySelector('.scaffold-layout__list-item');
card.getAttribute('data-occludable-job-id');

// Check if badges exist in the DOM
document.querySelectorAll('.linkedin-job-badge-container').length
```

### Expected Behavior

1. **First time loading LinkedIn Jobs:**
   - Badge scanner initializes after 2-3 seconds
   - Loading indicators appear on all visible job cards
   - Extension automatically clicks through each job to analyze it
   - Loading indicators are replaced with badges as analysis completes

2. **Automatic scanning process:**
   - Extension scans jobs one by one (1.5 second delay between each)
   - You'll see the job details panel change as it clicks through jobs
   - This is normal - the extension is fetching job descriptions
   - Badges appear on each card after its analysis is complete

3. **After initial scan completes:**
   - All visible job cards show their badges
   - Badges persist even when you navigate away

4. **After scrolling or loading more jobs:**
   - New job cards get loading indicators
   - Extension automatically scans the new jobs
   - Badges appear after analysis

### Visual Verification

Badges should look like this:
- Small rounded rectangles
- White text on colored background
- Appear below the company name or location
- Multiple badges in a row with small gaps between them

Example:
```
[Job Title]
Company Name
Location (Remote)
[✓ Visa] [kubernetes] [docker] [python]  ← Badges appear here
```

