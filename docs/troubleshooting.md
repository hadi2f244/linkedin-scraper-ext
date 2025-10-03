# Troubleshooting Guide

Solutions to common issues and problems.

---

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Side Panel Issues](#side-panel-issues)
3. [Company Name Detection](#company-name-detection)
4. [Visa Sponsorship Issues](#visa-sponsorship-issues)
5. [Keyword Search Issues](#keyword-search-issues)
6. [AI Summary Issues](#ai-summary-issues)
7. [Performance Issues](#performance-issues)
8. [Data & Storage Issues](#data--storage-issues)

---

## Installation Issues

### Extension Won't Load

**Error: "Manifest file is missing or unreadable"**

**Cause:** Wrong folder selected or corrupted download

**Solutions:**
1. Ensure you selected the folder containing `manifest.json`
2. Don't select a parent or subfolder
3. Re-download the extension
4. Check file permissions

**Verify:**
```
linkedin-scraper-ext/
├── manifest.json  ← This file must exist
├── background.js
├── content.js
└── ...
```

---

### Manifest Version Error

**Error: "Manifest version 2 is deprecated"**

**Cause:** Chrome version too old

**Solutions:**
1. Update Chrome to latest version
2. Check Chrome version: `chrome://version/`
3. Minimum required: Chrome 109+

---

### Permission Errors

**Error: "Cannot access chrome.sidePanel"**

**Cause:** Browser doesn't support Side Panel API

**Solutions:**
1. Update Chrome to version 114+
2. Use Chrome (not Firefox or Safari)
3. Check if using Chromium-based browser

---

## Side Panel Issues

### Side Panel Won't Open

**Symptom:** Clicking extension icon does nothing

**Solutions:**

1. **Check URL:**
   - Must be on `linkedin.com/jobs/*`
   - Won't work on other LinkedIn pages
   - Won't work on non-LinkedIn sites

2. **Reload Extension:**
   - Go to `chrome://extensions/`
   - Find extension
   - Click refresh icon (🔄)

3. **Reload LinkedIn Page:**
   - Press F5 or Ctrl+R
   - Wait for page to fully load
   - Try clicking extension icon again

4. **Check Console:**
   - Open DevTools (F12)
   - Check for errors
   - Look for "side panel" related messages

---

### Side Panel Opens But Empty

**Symptom:** Side panel shows but no content

**Solutions:**

1. **Click on a job:**
   - Side panel needs a job selected
   - Click any job listing
   - Wait 2-3 seconds

2. **Click "Refresh Job Data":**
   - Button in side panel
   - Forces data reload

3. **Check Console:**
   - F12 on LinkedIn page
   - Filter by "LinkedIn Scraper"
   - See if data is being extracted

---

### Side Panel Doesn't Update

**Symptom:** Clicking different jobs doesn't update panel

**Solutions:**

1. **Wait a moment:**
   - Updates can take 1-2 seconds
   - LinkedIn loads content dynamically

2. **Click "Refresh Job Data":**
   - Manual refresh button
   - Forces immediate update

3. **Reload Extension:**
   - `chrome://extensions/`
   - Refresh extension
   - Reload LinkedIn page

---

## Company Name Detection

### Company Name Not Detected

**Symptom:** Input field stays empty, shows "Enter company name..."

**Debug Steps:**

1. **Open Console:**
   - Press F12 on LinkedIn page
   - Go to Console tab
   - Filter by "LinkedIn Scraper"

2. **Look for logs:**
   ```
   [LinkedIn Scraper] Attempting to extract company name...
   [LinkedIn Scraper] Trying selector: Primary (div.company-name > a)
   [LinkedIn Scraper] Element found: <a>
   [LinkedIn Scraper] ✓ SUCCESS! Found company name: "CompanyName"
   ```

3. **If you see "Element not found":**
   - LinkedIn changed their HTML structure
   - Report on GitHub with job URL
   - Use manual input as workaround

**Workarounds:**

1. **Manual Input:**
   - Type company name in input field
   - Click "Check Visa"

2. **Check LinkedIn Company Page:**
   - Click company name in job posting
   - See official company name
   - Use that for manual search

---

### Wrong Company Name Detected

**Symptom:** Input shows incorrect company name

**Causes:**
- LinkedIn page structure variation
- Sponsored job with different company
- Job posted by recruiter

**Solutions:**

1. **Verify on LinkedIn:**
   - Check company name in job posting
   - Look at company logo/link

2. **Manual Override:**
   - Clear input field
   - Type correct company name
   - Click "Check Visa"

3. **Report Issue:**
   - Note the job URL
   - Note detected vs actual company
   - Open GitHub issue

---

## Visa Sponsorship Issues

### CSV Upload Fails

**Error: "Error reading file"**

**Solutions:**

1. **Verify File:**
   - Must be CSV format
   - Download from official UK government site
   - Don't edit the file

2. **Check File Size:**
   - Should be 10-15MB
   - If much smaller, might be corrupted
   - Re-download

3. **Try Different Browser:**
   - Some browsers handle large files better
   - Try Chrome Canary or Edge

**Error: "Resource::kQuotaBytes quota exceeded"**

**This should NOT happen** with current version.

**If you see this:**
- You're using an old version
- Update to latest version
- Report on GitHub

---

### No Results for Known Sponsor

**Symptom:** Company should be sponsor but shows "Not found"

**Possible Causes & Solutions:**

1. **Name Mismatch:**
   - **Problem:** Brand name ≠ legal name
   - **Example:** "Google" vs "Google UK Limited"
   - **Solution:** Try variations:
     - Add "UK", "Limited", "Ltd"
     - Remove "The", "Group", etc.
     - Check company website for legal name

2. **CSV Outdated:**
   - **Problem:** Company recently added/removed
   - **Solution:** Download latest CSV from government site

3. **Subsidiary:**
   - **Problem:** Job is for subsidiary
   - **Example:** "Google Cloud" vs "Google UK"
   - **Solution:** Search for both parent and subsidiary

4. **Not Actually a Sponsor:**
   - **Problem:** Assumption was wrong
   - **Solution:** Verify on [official register](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers)

---

### Too Many Irrelevant Results

**Symptom:** Results show unrelated companies

**Causes:**
- Common company name
- Short name (e.g., "IBM", "EY")
- Generic terms

**Solutions:**

1. **Check Match Quality:**
   - Focus on "Exact Match" results
   - Ignore "Possible Match" if not relevant

2. **Use Full Name:**
   - Instead of "Google", try "Google UK"
   - Instead of "IBM", try "IBM United Kingdom"

3. **Check Location:**
   - Match company location with job location
   - London company unlikely for Manchester job

4. **Verify on LinkedIn:**
   - Click company name in job
   - See official company page
   - Use exact name from there

---

## Keyword Search Issues

### Keywords Not Showing

**Symptom:** No keyword results appear

**Solutions:**

1. **Check Configuration:**
   - Right-click extension → Options
   - Verify keywords are entered
   - Format: `keyword1, keyword2, keyword3`
   - Click "Save Settings"

2. **Reload Extension:**
   - `chrome://extensions/`
   - Refresh extension
   - Reload LinkedIn page

3. **Check Job Data:**
   - Ensure job text is loaded
   - Look for "Job data loaded ✓"
   - Try "Refresh Job Data"

---

### All Keywords Show Red ❌

**Symptom:** All keywords marked as not found

**Possible Causes:**

1. **Job Text Not Loaded:**
   - Wait for job to fully load
   - Click "Refresh Job Data"

2. **Case Sensitivity:**
   - Keywords are case-insensitive
   - "Python" should match "python"
   - If not, report as bug

3. **Spelling:**
   - Check keyword spelling
   - "kubernetes" not "kubernates"
   - "CI/CD" not "CICD"

---

### Keywords Not Updating

**Symptom:** Changed keywords in Options but results don't change

**Solutions:**

1. **Save Settings:**
   - Ensure you clicked "Save Settings"
   - Look for confirmation message

2. **Reload Extension:**
   - `chrome://extensions/`
   - Refresh extension

3. **Reload Job:**
   - Click "Refresh Job Data"
   - Or click different job and back

---

## AI Summary Issues

### "No job data to send"

**Symptom:** Can't send to ChatGPT

**Solutions:**

1. **Load Job Data:**
   - Click on a LinkedIn job
   - Wait for "Job data loaded ✓"
   - Try "Refresh Job Data"

2. **Check Job Text:**
   - Click "Read more" to see full text
   - If empty, job didn't load properly
   - Refresh LinkedIn page

---

### API Key Error

**Error: "Invalid API key"**

**Solutions:**

1. **Verify API Key:**
   - Should start with `sk-`
   - No extra spaces
   - Copy-paste carefully

2. **Check OpenAI Account:**
   - Login to [OpenAI Platform](https://platform.openai.com/)
   - Verify API key exists
   - Check it's not revoked

3. **Create New Key:**
   - Go to API Keys section
   - Create new secret key
   - Replace in extension Options

---

### Request Fails / Timeout

**Error: "Failed to fetch" or timeout**

**Solutions:**

1. **Check Internet:**
   - Verify connection working
   - Try other websites

2. **Check OpenAI Status:**
   - Visit [OpenAI Status Page](https://status.openai.com/)
   - See if API is down

3. **Check API Credits:**
   - Login to OpenAI
   - Verify you have credits
   - Add payment method if needed

4. **Try Again:**
   - Click "Send to ChatGPT" again
   - Sometimes temporary network issue

---

### Response is Gibberish

**Symptom:** AI returns nonsense or wrong format

**Solutions:**

1. **Check Prompt:**
   - Review custom prompt in Options
   - Ensure it's clear and specific
   - Try default prompt

2. **Check Model:**
   - Extension uses GPT-3.5-turbo by default
   - Verify in code if needed

3. **Try Different Job:**
   - Some job descriptions are poorly formatted
   - Try a different job to test

---

## Performance Issues

### Extension Slow

**Symptom:** Side panel takes long to load/update

**Solutions:**

1. **Large CSV:**
   - 50,000+ companies takes time to search
   - This is normal (1-2 seconds)
   - Consider if you need full CSV

2. **Too Many Tabs:**
   - Close unused LinkedIn tabs
   - Each tab runs content script

3. **Clear Browser Cache:**
   - Settings → Privacy → Clear browsing data
   - Keep "Cookies" unchecked
   - Clear cache only

---

### High Memory Usage

**Symptom:** Chrome uses lots of RAM

**Causes:**
- IndexedDB with large CSV
- Multiple LinkedIn tabs
- Other extensions

**Solutions:**

1. **Close Unused Tabs:**
   - Keep only one LinkedIn tab open

2. **Restart Browser:**
   - Close and reopen Chrome
   - Memory will be freed

3. **Check Other Extensions:**
   - Disable other extensions temporarily
   - See if issue persists

---

## Data & Storage Issues

### Settings Not Saving

**Symptom:** Options reset after closing

**Solutions:**

1. **Click "Save Settings":**
   - Don't just close Options page
   - Must click save button

2. **Check Permissions:**
   - Extension needs storage permission
   - Verify in `chrome://extensions/`

3. **Check Browser:**
   - Not in Incognito mode
   - Storage not disabled

---

### CSV Data Lost

**Symptom:** Need to re-upload CSV after restart

**This should NOT happen.**

**If it does:**

1. **Check Browser Settings:**
   - Settings → Privacy
   - Ensure "Cookies and site data" not cleared on exit

2. **Check IndexedDB:**
   - F12 → Application → IndexedDB
   - Look for "VisaSponsorDB"
   - If missing, data was cleared

3. **Re-upload CSV:**
   - Go to Options
   - Upload CSV again

4. **Report Bug:**
   - This is not expected behavior
   - Open GitHub issue

---

## Getting Help

### Before Reporting an Issue

**Collect Information:**

1. **Chrome Version:**
   - Go to `chrome://version/`
   - Copy version number

2. **Console Logs:**
   - F12 on LinkedIn page
   - Filter by "LinkedIn Scraper"
   - Screenshot or copy logs

3. **Extension Console:**
   - F12 on side panel
   - Check for errors
   - Screenshot or copy

4. **Steps to Reproduce:**
   - What you did
   - What you expected
   - What actually happened

5. **Job URL:**
   - If issue is job-specific
   - Share LinkedIn job URL

### Where to Get Help

1. **Check Documentation:**
   - [Full Documentation](README.md)
   - [Installation Guide](installation.md)
   - [Visa Sponsorship Guide](visa-sponsorship.md)

2. **GitHub Issues:**
   - Search existing issues
   - Open new issue with details above

3. **Browser Console:**
   - Often shows the exact error
   - Helps debug yourself

---

## Common Error Messages

### "Could not connect to LinkedIn page"

**Cause:** Content script not loaded

**Solutions:**
- Refresh LinkedIn page
- Reload extension
- Check you're on `linkedin.com/jobs/*`

---

### "No active tab found"

**Cause:** Extension can't access current tab

**Solutions:**
- Ensure LinkedIn tab is active
- Click on LinkedIn tab first
- Reload extension

---

### "Please navigate to a LinkedIn job page"

**Cause:** Not on correct LinkedIn URL

**Solutions:**
- Go to `linkedin.com/jobs/`
- Click on a job listing
- Ensure URL contains `/jobs/`

---

### "No visa sponsorship data loaded"

**Cause:** CSV not uploaded

**Solutions:**
- Go to Options
- Upload UK Worker CSV
- See [Visa Sponsorship Guide](visa-sponsorship.md)

---

**Still having issues?** Open a [GitHub issue](https://github.com/yourusername/linkedin-scraper-ext/issues) with details.

