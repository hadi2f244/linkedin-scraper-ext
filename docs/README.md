# LinkedIn Job Scraper & AI Analyzer - Complete Documentation

Welcome to the complete documentation for the LinkedIn Job Scraper & AI Analyzer Chrome Extension.

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [Features in Detail](#features-in-detail)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Usage Guide](#usage-guide)
6. [Advanced Features](#advanced-features)
7. [Technical Architecture](#technical-architecture)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## Overview

This Chrome extension enhances your LinkedIn job search experience by automatically:
- Scraping job descriptions in real-time
- Checking UK visa sponsorship eligibility
- Highlighting important keywords
- Generating AI-powered summaries

### Why Use This Extension?

- **Save Time**: No more copy-pasting job descriptions
- **Make Informed Decisions**: Instant visa sponsorship verification
- **Focus on What Matters**: Keyword matching shows if you meet requirements
- **Get Insights**: AI summaries extract key information
- **Stay Organized**: Side panel keeps everything accessible

---

## Features in Detail

### 1. Automatic Job Scraping

**How it works:**
- Side panel opens automatically when you visit LinkedIn jobs
- Monitors page changes using MutationObserver
- Extracts job details when you click on a listing
- Updates in real-time without manual intervention

**What gets extracted:**
- Full job description text
- Company name
- Job URL
- Timestamp

**Text Processing:**
- Removes HTML tags
- Normalizes whitespace
- Cleans formatting artifacts
- Preserves readability

### 2. UK Visa Sponsorship Checker

**Overview:**
Instantly verify if a company is a licensed UK visa sponsor by checking against the official government register.

**Features:**
- Upload official UK government CSV (12MB+ supported)
- Automatic company name detection from job postings
- Smart matching algorithm handles variations
- Top 5 results sorted by relevance
- Match quality indicators
- Manual search fallback

**Match Quality:**
- **Exact Match** (Score ≥ 90): Perfect match
- **High Match** (Score ≥ 80): Very likely correct
- **Possible Match** (Score < 80): Might be correct

**Matching Algorithm:**
- Normalizes company names (lowercase, removes special chars)
- Extracts core name (removes Ltd, Limited, PLC, etc.)
- Strict matching for short names (≤5 characters)
- Flexible matching for longer names
- Scoring system prioritizes exact matches

**Example Matches:**
- "Google" → "Google UK Limited" ✅
- "IBM" → "IBM United Kingdom Limited" ✅
- "Teya" → "Teya" ✅ (but NOT "Teya Technologies")

### 3. Keyword Search

**Purpose:**
Quickly check if a job description mentions specific skills or requirements.

**How to use:**
1. Add comma-separated keywords in Options
2. Keywords are searched in job descriptions
3. Results show ✅ (found) or ❌ (not found)

**Example Keywords:**
```
kubernetes, CI/CD, python, aws, docker, terraform, golang, react, typescript
```

**Display:**
```
Keyword Search Results:
✅ kubernetes
✅ CI/CD
✅ python
❌ golang
❌ react
```

### 4. AI-Powered Summaries

**Integration:**
- Uses ChatGPT API for intelligent analysis
- Custom prompts for personalized output
- Streaming responses for faster feedback
- Cancellable requests

**Features:**
- Auto-send option (configurable)
- Manual send button
- Stop/cancel mid-request
- Custom prompt configuration

**Example Prompt:**
See [prompt-examples.md](prompt-examples.md) for various prompt templates.

---

## Installation

See [installation.md](installation.md) for detailed installation instructions.

**Quick Steps:**
1. Clone repository
2. Open `chrome://extensions/`
3. Enable Developer Mode
4. Load unpacked extension
5. Configure options

---

## Configuration

### API Key Setup

**For ChatGPT Integration:**
1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Right-click extension → Options
3. Paste API key
4. Save

**Alternative:**
Create `prompt.txt` in root folder with your prompt.

### Keywords Configuration

**Format:** Comma-separated list

**Examples:**
```
kubernetes, docker, CI/CD
python, golang, java, typescript
aws, azure, gcp, terraform
```

**Tips:**
- Use lowercase for consistency
- Separate with commas
- No quotes needed
- Spaces are trimmed automatically

### CSV Upload

**Where to get the file:**
1. Visit [UK Government - Register of Licensed Sponsors](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers)
2. Download "Worker and Temporary Worker" CSV
3. File is typically 10-15MB

**How to upload:**
1. Right-click extension → Options
2. Click "Choose File" under UK Visa Sponsorship
3. Select downloaded CSV
4. Wait for upload confirmation
5. See company count

**Storage:**
- Uses IndexedDB (not chrome.storage)
- Supports files 12MB+
- Data persists across browser sessions
- Stored locally in your browser

### Auto-send Configuration

**Option:** Auto-send to ChatGPT

**When enabled:**
- Jobs automatically sent to ChatGPT
- Summary appears without clicking

**When disabled (default):**
- Manual control via "Send to ChatGPT" button
- Better for reviewing jobs first

---

## Usage Guide

### Automatic Mode (Recommended)

**Step-by-step:**
1. Navigate to LinkedIn Jobs
2. Side panel opens automatically
3. Click on any job listing
4. Wait 1-2 seconds for data to load
5. Review results:
   - Company name (auto-detected)
   - Visa sponsorship status
   - Keyword matches
   - AI summary (if auto-send enabled)

**Tips:**
- Side panel stays open as you browse
- Click "Refresh Job Data" if data doesn't load
- Use "Read more" to see full job description

### Manual Mode

**When to use:**
- Company name not detected
- Want to check different company
- Need to refresh data

**How to use:**
1. Enter company name manually
2. Click "Check Visa"
3. Click "Send to ChatGPT" for summary
4. Click "Refresh Job Data" to reload

### Reading Job Details

**Expandable Text:**
- Preview shows ~150px of text
- Click "Read more ▼" to expand
- Click "Read less ▲" to collapse

**Why expandable?**
- Keeps UI clean
- Quick scanning
- Full text available when needed

---

## Advanced Features

### Company Name Detection

**How it works:**
1. Content script monitors LinkedIn page
2. Waits for company name element to load
3. Tries multiple selectors in priority order
4. Retries every 200ms for up to 3 seconds
5. Sends to side panel when found

**Selectors used (in order):**
1. `.job-details-jobs-unified-top-card__company-name a`
2. `.job-details-jobs-unified-top-card__company-name` (with anchor inside)
3. `.job-details-jobs-unified-top-card__container--two-pane a[href*="/company/"]`
4. Various fallback selectors

**Debugging:**
- Open browser console (F12)
- Filter by "LinkedIn Scraper"
- See which selector worked
- Check extraction attempts

### Smart Company Matching

**Algorithm Details:**

**Step 1: Normalization**
```javascript
"Google UK Ltd." → "google uk ltd"
"IBM (United Kingdom)" → "ibm united kingdom"
```

**Step 2: Core Extraction**
```javascript
"google uk ltd" → "google"
"ibm united kingdom" → "ibm"
```

**Step 3: Matching**
- Exact match: 100 points
- Core match: 90 points
- Starts with: 80 points
- Contains: 50 points

**Step 4: Filtering**
- Short names (≤5 chars): Require exact core match
- Long names: More flexible matching
- Top 5 results only
- Sorted by score

### IndexedDB Storage

**Why IndexedDB?**
- chrome.storage.local limited to 5-10MB
- IndexedDB supports hundreds of MB
- Faster for large datasets
- Better for searching

**Database Structure:**
```
VisaSponsorDB
├── companies (object store)
│   ├── key: auto-increment ID
│   └── value: company record
└── metadata (object store)
    ├── filename
    ├── companyCount
    └── uploadDate
```

**Operations:**
- `openDatabase()`: Opens/creates DB
- `saveToIndexedDB()`: Stores CSV data
- `searchCompaniesInIndexedDB()`: Searches all companies
- `getMetadataFromIndexedDB()`: Gets file info

---

## Technical Architecture

See [architecture.md](architecture.md) for detailed technical documentation.

**Key Components:**
- **manifest.json**: Extension configuration
- **background.js**: Service worker, message routing
- **content.js**: LinkedIn page scraper
- **sidepanel.html/js/css**: UI and logic
- **options.html/js**: Settings page

**Communication Flow:**
```
LinkedIn Page (content.js)
    ↓ (message)
Background Worker (background.js)
    ↓ (forward)
Side Panel (sidepanel.js)
    ↓ (display)
User Interface
```

---

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for detailed solutions.

**Common Issues:**
- Company name not detected
- CSV upload fails
- Wrong company matches
- AI summary not working
- Side panel not opening

---

## FAQ

**Q: Is my data safe?**  
A: Yes! Everything runs locally in your browser. Only ChatGPT API calls go external (optional).

**Q: Does it work on other job sites?**  
A: Currently LinkedIn only. The extension is specifically designed for LinkedIn's structure.

**Q: Can I use a different AI service?**  
A: The code uses OpenAI API. You can modify `sidepanel.js` to use other services.

**Q: How often should I update the CSV?**  
A: UK government updates monthly. Check quarterly for latest sponsors.

**Q: Does it work on mobile?**  
A: No, Chrome extensions only work on desktop browsers.

**Q: Can I export the results?**  
A: Not currently, but you can copy text from the side panel.

---

## Additional Resources

- [Installation Guide](installation.md)
- [Visa Sponsorship Guide](visa-sponsorship.md)
- [Prompt Examples](prompt-examples.md)
- [Troubleshooting](troubleshooting.md)
- [API Reference](api-reference.md)
- [Contributing Guide](CONTRIBUTING.md)

---

**Need help?** Open an issue on GitHub or check the troubleshooting guide.

