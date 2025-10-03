# Installation Guide

Complete step-by-step guide to install and configure the LinkedIn Job Scraper & AI Analyzer extension.

---

## Prerequisites

- **Google Chrome** (or Chromium-based browser like Edge, Brave)
- **Git** (optional, for cloning)
- **OpenAI API Key** (optional, only for AI summaries)
- **UK Visa CSV** (optional, only for sponsorship checks)

---

## Step 1: Download the Extension

### Option A: Clone with Git

```bash
git clone https://github.com/hadi2f244/linkedin-scraper-ext
cd linkedin-scraper-ext
```

### Option B: Download ZIP

1. Go to the GitHub repository
2. Click "Code" → "Download ZIP"
3. Extract the ZIP file to a folder
4. Remember the folder location

---

## Step 2: Install in Chrome

### 2.1 Open Extensions Page

**Method 1:** Type in address bar:
```
chrome://extensions/
```

**Method 2:** Menu navigation:
1. Click three dots (⋮) in top-right
2. More tools → Extensions

### 2.2 Enable Developer Mode

1. Look for "Developer mode" toggle in top-right
2. Click to enable (should turn blue/on)

### 2.3 Load the Extension

1. Click **"Load unpacked"** button
2. Navigate to the extension folder
3. Select the folder (the one containing `manifest.json`)
4. Click "Select Folder"

### 2.4 Verify Installation

You should see:
- Extension card with name "LinkedIn Job Scraper"
- Extension icon in Chrome toolbar
- No errors in the card

**If you see errors:**
- Check that you selected the correct folder
- Ensure `manifest.json` is in the root of the folder
- See [Troubleshooting](#troubleshooting) below

---

## Step 3: Configure the Extension

### 3.1 Open Options Page

**Method 1:** Right-click extension icon → "Options"

**Method 2:** 
1. Go to `chrome://extensions/`
2. Find the extension
3. Click "Details"
4. Scroll down → Click "Extension options"

### 3.2 Configure API Key (Optional)

**For AI Summaries:**

1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Sign up/login to OpenAI
   - Go to API Keys section
   - Click "Create new secret key"
   - Copy the key (starts with `sk-`)

2. Paste in "OpenAI API Key" field
3. Click "Save Settings"

**Note:** Without API key, AI summary feature won't work, but other features will.

### 3.3 Configure Custom Prompt (Optional)

**Default Prompt:**
The extension includes a default prompt for job summaries.

**Custom Prompt:**
1. In Options, find "Custom Prompt" textarea
2. Enter your preferred prompt format
3. Click "Save Settings"

**Example Prompts:**
See [prompt-examples.md](prompt-examples.md) for templates.

### 3.4 Add Keywords (Optional)

**For Keyword Search:**

1. In Options, find "Search Keywords" field
2. Enter comma-separated keywords
3. Example: `kubernetes, CI/CD, python, aws, docker`
4. Click "Save Settings"

**Tips:**
- Use lowercase for consistency
- Separate with commas
- No quotes needed
- Common keywords: programming languages, tools, frameworks

### 3.5 Upload CSV (Optional)

**For UK Visa Sponsorship Checks:**

1. Download CSV from [UK Government](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers)
   - Look for "Worker and Temporary Worker" CSV
   - File is typically 10-15MB
   - Updated monthly by UK government

2. In Options, find "UK Visa Sponsorship CSV File" section
3. Click "Choose File"
4. Select the downloaded CSV
5. Wait for upload (may take 5-10 seconds)
6. See confirmation: "✓ Loaded: filename.csv (X companies)"

**Note:** File is stored locally in your browser's IndexedDB.

### 3.6 Configure Auto-send (Optional)

**Auto-send to ChatGPT:**

- **Checked**: Jobs automatically sent to ChatGPT when you click them
- **Unchecked** (default): Manual control via "Send to ChatGPT" button

**Recommendation:** Leave unchecked initially to avoid API costs.

---

## Step 4: Test the Extension

### 4.1 Navigate to LinkedIn

1. Go to [LinkedIn Jobs](https://www.linkedin.com/jobs/)
2. Side panel should open automatically
3. If not, click the extension icon

### 4.2 Click on a Job

1. Click any job listing
2. Wait 1-2 seconds
3. Side panel should update with:
   - Job text preview
   - Company name (if detected)
   - Keyword results (if configured)
   - Visa check results (if CSV uploaded)

### 4.3 Test Features

**Test Visa Check:**
1. Look for company name in input field
2. Should auto-populate
3. Results appear below
4. Try manual search if needed

**Test Keywords:**
1. Should see list with ✅ or ❌
2. Each keyword on separate line

**Test AI Summary:**
1. Click "Send to ChatGPT"
2. Wait for response
3. See structured summary
4. Try "Stop ChatGPT" to cancel

---

## Step 5: Pin the Extension (Optional)

**For Easy Access:**

1. Click puzzle piece icon in Chrome toolbar
2. Find "LinkedIn Job Scraper"
3. Click pin icon
4. Extension icon appears in toolbar

---

## Troubleshooting

### Extension Won't Load

**Error: "Manifest file is missing or unreadable"**
- Ensure you selected the correct folder
- Check that `manifest.json` exists in the folder
- Try downloading again

**Error: "Manifest version 2 is deprecated"**
- This extension uses Manifest V3
- Update Chrome to latest version
- If using old Chrome, extension won't work

**Error: "Required value 'version' is missing"**
- `manifest.json` is corrupted
- Re-download the extension

### Side Panel Won't Open

**Issue:** Side panel doesn't appear on LinkedIn

**Solutions:**
1. Click extension icon manually
2. Refresh LinkedIn page
3. Check you're on `linkedin.com/jobs/*` URL
4. Reload extension:
   - Go to `chrome://extensions/`
   - Click refresh icon on extension card

### Options Page Won't Save

**Issue:** Settings don't persist

**Solutions:**
1. Check browser console for errors (F12)
2. Ensure you clicked "Save Settings"
3. Try reloading extension
4. Check Chrome storage permissions

### CSV Upload Fails

**Error: "Error reading file"**
- Check file is valid CSV
- Ensure file isn't corrupted
- Try re-downloading from UK government site

**Error: "Resource::kQuotaBytes quota exceeded"**
- This should NOT happen (we use IndexedDB)
- If you see this, the extension needs updating
- Report as bug

### Company Name Not Detected

**Issue:** Input field stays empty

**Solutions:**
1. Open browser console (F12) on LinkedIn page
2. Filter logs by "LinkedIn Scraper"
3. Check what selectors are being tried
4. Use manual input as fallback
5. Report which company/job failed

### API Key Not Working

**Issue:** AI summaries fail

**Solutions:**
1. Verify API key is correct (starts with `sk-`)
2. Check OpenAI account has credits
3. Test API key at [OpenAI Playground](https://platform.openai.com/playground)
4. Check browser console for error messages

---

## Updating the Extension

### When to Update

- New features released
- Bug fixes available
- CSV format changes

### How to Update

**Method 1: Git Pull**
```bash
cd linkedin-scraper-ext
git pull origin main
```

**Method 2: Manual Download**
1. Download latest version
2. Extract to same folder (overwrite)

**After Updating:**
1. Go to `chrome://extensions/`
2. Click refresh icon on extension card
3. Test that it still works

---

## Uninstalling

### Remove Extension

1. Go to `chrome://extensions/`
2. Find "LinkedIn Job Scraper"
3. Click "Remove"
4. Confirm removal

### Clean Up Data

**Extension data is automatically removed when you uninstall.**

**To manually clear:**
1. Open DevTools (F12) on any page
2. Application tab → Storage
3. IndexedDB → Delete "VisaSponsorDB"
4. Local Storage → Delete extension data

---

## Next Steps

- ✅ Extension installed
- ✅ Settings configured
- ✅ Features tested

**Now:**
- Read [Usage Guide](README.md#usage-guide)
- Check [Prompt Examples](prompt-examples.md)
- Review [Troubleshooting](troubleshooting.md)

---

**Need help?** Open an issue on GitHub with:
- Chrome version
- Error messages
- Console logs
- Steps to reproduce

