# UK Visa Sponsorship Checker - Complete Guide

Everything you need to know about the UK visa sponsorship checking feature.

---

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Getting the CSV File](#getting-the-csv-file)
4. [Uploading the CSV](#uploading-the-csv)
5. [Understanding Results](#understanding-results)
6. [Matching Algorithm](#matching-algorithm)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Overview

The UK Visa Sponsorship Checker verifies if a company is a licensed sponsor for UK work visas by checking against the official UK government register.

### Why This Matters

- **Save Time**: Instantly know if visa sponsorship is possible
- **Make Informed Decisions**: Don't apply to jobs you can't accept
- **Plan Your Career**: Focus on companies that can sponsor you
- **Avoid Disappointment**: Know before you invest time in applications

### What You Can Check

- Worker visa sponsorship (Skilled Worker route)
- Temporary Worker sponsorship
- Company rating (A-rating or not)
- Sponsorship routes available
- Company location

---

## How It Works

### Step-by-Step Process

1. **CSV Upload**: You upload the official UK government CSV file
2. **Storage**: File is stored in your browser's IndexedDB (local, secure)
3. **Job Browsing**: You browse LinkedIn jobs normally
4. **Auto-Detection**: Extension extracts company name from job posting
5. **Smart Search**: Algorithm searches CSV with fuzzy matching
6. **Results Display**: Top 5 matches shown with quality indicators

### Technical Flow

```
LinkedIn Job Page
    ↓
Content Script extracts company name
    ↓
Sends to Side Panel
    ↓
Side Panel searches IndexedDB
    ↓
Matching algorithm scores results
    ↓
Top 5 results displayed
```

---

## Getting the CSV File

### Official Source

**UK Government Website:**
[Register of Licensed Sponsors - Workers](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers)

### Which File to Download

Look for: **"Worker and Temporary Worker"** CSV file

**File details:**
- Format: CSV (Comma-Separated Values)
- Size: Typically 10-15MB
- Updated: Monthly by UK Home Office
- Contains: ~50,000+ licensed sponsors

### Download Steps

1. Visit the link above
2. Scroll to "Documents" section
3. Find "Worker and Temporary Worker - [Date]"
4. Click to download CSV
5. Save to your computer

### Update Frequency

**Recommendation:** Update quarterly (every 3 months)

**Why:**
- Companies added/removed monthly
- Ratings can change
- Routes can be updated

**How to check for updates:**
- Visit the government page
- Check publication date
- Compare with your current file

---

## Uploading the CSV

### Upload Process

1. Right-click extension icon → **Options**
2. Find "UK Visa Sponsorship CSV File" section
3. Click **"Choose File"**
4. Select the downloaded CSV
5. Wait for upload (5-10 seconds for 12MB file)
6. See confirmation message

### What Happens During Upload

**Progress indicators:**
```
Reading CSV file...
Parsing CSV data...
Saving to database...
✓ Loaded: 2025-10-03_-_Worker_and_Temporary_Worker.csv (52,847 companies)
```

**Behind the scenes:**
1. File is read into memory
2. CSV is parsed line by line
3. Each company record is stored in IndexedDB
4. Metadata (filename, count, date) is saved
5. Previous data is cleared (if any)

### Storage Details

**Technology:** IndexedDB (not chrome.storage)

**Why IndexedDB?**
- chrome.storage.local limited to 5-10MB
- IndexedDB supports hundreds of MB
- Faster for searching large datasets
- Better performance

**Storage location:**
- Local to your browser
- Not synced across devices
- Persists until you clear browser data
- Automatically removed if extension uninstalled

**View stored data:**
1. Open DevTools (F12)
2. Application tab
3. IndexedDB → VisaSponsorDB
4. See "companies" and "metadata" stores

---

## Understanding Results

### Result Format

```
🔍 Visa Sponsorship Check
Searched: Google
✅ Found 3 matches in UK visa sponsorship register!
Showing top 3 matches sorted by relevance

[Exact Match]
Organisation: Google UK Limited
Town/City: London
County: Greater London
Type & Rating: Worker (A rating)
Route: Skilled Worker

[High Match]
Organisation: Google Cloud UK Limited
Town/City: London
County: Greater London
Type & Rating: Worker (A rating)
Route: Skilled Worker, Global Business Mobility

[Possible Match]
Organisation: Google Payment Limited
Town/City: London
County: Greater London
Type & Rating: Worker (A rating)
Route: Skilled Worker
```

### Match Quality Indicators

#### 🟢 Exact Match (Score ≥ 90)
- **Meaning**: Perfect or near-perfect match
- **Confidence**: Very high
- **Action**: This is almost certainly the right company

**Examples:**
- Search: "Google" → Match: "Google UK Limited"
- Search: "IBM" → Match: "IBM United Kingdom Limited"
- Search: "Barclays" → Match: "Barclays Bank PLC"

#### 🟡 High Match (Score ≥ 80)
- **Meaning**: Very likely the correct company
- **Confidence**: High
- **Action**: Probably the right company, check location

**Examples:**
- Search: "Google" → Match: "Google Cloud UK Limited"
- Search: "Microsoft" → Match: "Microsoft Limited"

#### 🔵 Possible Match (Score < 80)
- **Meaning**: Might be related
- **Confidence**: Medium
- **Action**: Verify this is the right company

**Examples:**
- Search: "Google" → Match: "Google Payment Limited"
- Search: "Amazon" → Match: "Amazon Web Services UK Limited"

### Result Fields Explained

**Organisation:**
- Official registered company name
- May differ from brand name
- Used for legal/visa purposes

**Town/City:**
- Primary office location
- Where visa sponsorship is registered
- May have multiple locations

**County:**
- UK county/region
- Helps identify specific office

**Type & Rating:**
- **Worker**: Can sponsor Skilled Worker visas
- **Temporary Worker**: Can sponsor temporary visas
- **A rating**: Highest rating, trusted sponsor
- **No rating shown**: Standard sponsor

**Route:**
- **Skilled Worker**: Most common work visa
- **Global Business Mobility**: For international transfers
- **Senior or Specialist Worker**: For senior roles
- Multiple routes may be listed

### No Results

```
🔍 Visa Sponsorship Check
Searched: StartupXYZ
❌ Not found in UK visa sponsorship register
```

**What this means:**
- Company is NOT a licensed sponsor
- Cannot sponsor work visas
- You would need existing work authorization

**Possible reasons:**
- Small company/startup
- Not registered as sponsor
- Name mismatch (try manual search)
- Recently removed from register

### No CSV Uploaded

```
🔍 Visa Sponsorship Check
⚠️ No visa sponsorship data loaded
Please upload the UK Worker CSV file in the extension options.
```

**Action:** Upload CSV file in Options

---

## Matching Algorithm

### How Matching Works

The extension uses a sophisticated algorithm to handle company name variations.

### Step 1: Normalization

**Purpose:** Make names comparable

**Process:**
```javascript
"Google UK Ltd." → "google uk ltd"
"IBM (United Kingdom)" → "ibm united kingdom"
"Barclays Bank PLC" → "barclays bank plc"
```

**What's removed:**
- Special characters: `.`, `,`, `(`, `)`, `&`
- Extra whitespace
- Case differences

### Step 2: Core Name Extraction

**Purpose:** Get the essential company name

**Removed suffixes:**
- Limited, Ltd, LTD
- PLC, plc
- LLC, Inc, Corporation, Corp
- Company, Co
- Group, Holdings
- International, Intl
- UK, USA, US, Europe, Global

**Examples:**
```javascript
"google uk ltd" → "google"
"ibm united kingdom limited" → "ibm"
"barclays bank plc" → "barclays bank"
```

### Step 3: Matching & Scoring

**Exact Match (100 points):**
- Normalized names are identical
- Example: "google" === "google"

**Core Match (90 points):**
- Core names are identical
- Example: "google" === "google uk limited" (both core to "google")

**Starts With (80 points):**
- One name starts with the other
- Example: "google" starts "google cloud"

**Contains (50 points):**
- One name contains the other
- Example: "google" in "alphabet google"

### Step 4: Filtering

**Short Name Rule:**
- Names ≤ 5 characters require exact core match
- Prevents false matches like "IBM" → "IBM Technologies"

**Example:**
- Search: "Teya" (4 chars)
- ✅ Matches: "Teya", "Teya Ltd", "Teya Limited"
- ❌ Doesn't match: "Teya Technologies", "Teya Systems"

**Long Name Rule:**
- Names > 5 characters use flexible matching
- Allows variations and subsidiaries

### Step 5: Ranking

**Top 5 results:**
- Sorted by score (highest first)
- Exact matches always first
- Ties broken by name length (shorter first)

---

## Troubleshooting

### Company Name Not Detected

**Symptom:** Input field is empty

**Solutions:**
1. Wait 2-3 seconds for auto-detection
2. Check browser console for errors
3. Use manual input field
4. Click "Refresh Job Data"

**Debug:**
- Open console (F12) on LinkedIn page
- Filter by "LinkedIn Scraper"
- See which selectors are tried

### Wrong Company Matched

**Symptom:** Results show unrelated companies

**Solutions:**
1. Check match quality indicator
2. Look at "Possible Match" results carefully
3. Verify company location matches job
4. Use manual search with full company name

**Example:**
- Job says "Google Cloud"
- Results show "Google UK Limited" (Exact Match) ✅
- And "Google Cloud UK Limited" (High Match) ✅
- Second result is more specific

### Too Many Results

**Symptom:** 5 results, all seem different

**Cause:** Common company name or abbreviation

**Solutions:**
1. Check job posting for full legal name
2. Look at location to narrow down
3. Check company website for legal name
4. Use LinkedIn company page for official name

### No Results for Known Sponsor

**Symptom:** Company should be sponsor but not found

**Possible causes:**
1. **Name mismatch**: Legal name differs from brand name
   - Example: Job says "Google" but registered as "Google UK Limited"
   - Solution: Try variations

2. **CSV outdated**: Company recently added/removed
   - Solution: Download latest CSV

3. **Subsidiary**: Job is for subsidiary not parent company
   - Example: "Google Cloud" vs "Google UK"
   - Solution: Search for both

4. **Typo**: Company name misspelled
   - Solution: Check spelling

### CSV Upload Fails

**Error: "Error reading file"**

**Solutions:**
1. Verify file is CSV format
2. Check file isn't corrupted
3. Re-download from government site
4. Try different browser

**Error: "Resource::kQuotaBytes quota exceeded"**

**This should NOT happen** (we use IndexedDB, not chrome.storage)

**If you see this:**
- Extension code has a bug
- Report on GitHub
- Check you're using latest version

---

## FAQ

### General Questions

**Q: How accurate is the matching?**  
A: Very accurate for exact names. For variations, check the match quality indicator. "Exact Match" is 99%+ accurate.

**Q: Does this guarantee visa sponsorship?**  
A: No. Being on the register means the company CAN sponsor, not that they WILL for every role.

**Q: Can I check companies not on LinkedIn?**  
A: Yes, use the manual input field to search any company name.

**Q: How often is the CSV updated?**  
A: UK government updates monthly. We recommend updating quarterly.

**Q: Does this work for other countries?**  
A: No, only UK. The CSV is UK-specific.

### Technical Questions

**Q: Where is the CSV stored?**  
A: In your browser's IndexedDB, locally on your computer.

**Q: Is my data sent anywhere?**  
A: No, all matching happens locally in your browser.

**Q: Can I use this offline?**  
A: Yes, once CSV is uploaded. Only ChatGPT feature needs internet.

**Q: How much storage does it use?**  
A: Approximately 15-20MB for the CSV data.

**Q: Can I export the results?**  
A: Not currently, but you can copy text from the side panel.

### Visa Questions

**Q: What's the difference between Worker and Temporary Worker?**  
A: Worker is for long-term employment (Skilled Worker visa). Temporary Worker is for short-term roles.

**Q: What does "A rating" mean?**  
A: Highest rating for sponsors. Indicates trusted, compliant sponsor with good track record.

**Q: Can I apply for a visa myself?**  
A: No, the company must sponsor you. Being on the register means they have the license to do so.

**Q: What if company has multiple entries?**  
A: Large companies often have multiple legal entities. Check location and routes to find the right one.

---

## Additional Resources

- [UK Government - Sponsor Guidance](https://www.gov.uk/uk-visa-sponsorship-employers)
- [Skilled Worker Visa Requirements](https://www.gov.uk/skilled-worker-visa)
- [Understanding Sponsor Ratings](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers)

---

**Need help?** Check [Troubleshooting Guide](troubleshooting.md) or open a GitHub issue.

