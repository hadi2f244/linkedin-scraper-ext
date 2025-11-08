# Technical Architecture

This document provides a detailed technical overview of the LinkedIn Job Scraper & AI Analyzer extension architecture.

---

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Storage Architecture](#storage-architecture)
6. [AI Integration](#ai-integration)
7. [Algorithms](#algorithms)
8. [Security](#security)

---

## Overview

The extension is built using Chrome Extension Manifest V3 with the following key components:

- **Content Script** (`content.js`) - Runs on LinkedIn pages
- **Background Service Worker** (`background.js`) - Handles messaging and company research
- **Side Panel** (`sidepanel.html/js/css`) - Main user interface
- **Options Page** (`options.html/js`) - Settings configuration
- **Copilot Auth** (`copilot-auth.js`) - GitHub Copilot authentication

---

## File Structure

```
linkedin-scraper-ext/
├── manifest.json              # Extension configuration (Manifest V3)
│
├── Core Scripts
│   ├── content.js            # Content script (runs on LinkedIn pages)
│   ├── background.js         # Background service worker
│   ├── sidepanel.js          # Side panel logic
│   ├── options.js            # Options page logic
│   └── copilot-auth.js       # GitHub Copilot authentication
│
├── UI Files
│   ├── sidepanel.html        # Side panel UI
│   ├── sidepanel.css         # Side panel styles
│   └── options.html          # Options page UI
│
├── Libraries
│   ├── pdf.min.js            # PDF.js library for PDF parsing/generation
│   └── pdf.worker.min.js     # PDF.js worker
│
└── Documentation
    ├── README.md             # Main documentation
    ├── FEATURES.md           # Complete feature list
    ├── ARCHITECTURE.md       # This file
    ├── installation.md       # Installation guide
    ├── visa-sponsorship.md   # Visa checker guide
    ├── copilot-integration.md # Copilot setup
    ├── prompt-examples.md    # Prompt examples
    ├── troubleshooting.md    # Troubleshooting guide
    └── CONTRIBUTING.md       # Contribution guide
```

---

## Component Architecture

### 1. Content Script (`content.js`)

**Purpose**: Runs on LinkedIn job pages to extract job data and display badges.

**Key Functions**:
- `extractJobDetails()` - Extracts job description from LinkedIn page
- `extractCompanyName()` - Extracts company name from job posting
- `checkAndSendJobDetails()` - Sends job data to side panel
- `setupObserver()` - Monitors page changes with MutationObserver
- `initBadgeScanner()` - Initializes badge scanner
- `scanAllJobCardsInBackground()` - Scans job listings for badges
- `highlightKeywordsOnPage()` - Highlights keywords on LinkedIn page

**Selectors Used**:
```javascript
// Job description
'.jobs-description__content'
'.jobs-box__html-content'
'.jobs-description'

// Job cards
'li.scaffold-layout__list-item[data-occludable-job-id]'

// Company name
'.job-details-jobs-unified-top-card__company-name'
'.jobs-unified-top-card__company-name'
```

**Message Types Sent**:
- `JOB_DATA_UPDATED` - Job data extracted and ready

**Message Types Received**:
- `REQUEST_JOB_DATA` - Request to re-send current job data

---

### 2. Background Service Worker (`background.js`)

**Purpose**: Routes messages and handles company research.

**Key Functions**:
- `handleResearchCompany()` - Orchestrates company research
- `extractContentFromTab()` - Extracts content from URLs
- `extractTextFromHTML()` - Intelligent text extraction (10 steps)
- `callAIForResearch()` - Calls AI for company research summarization

**Message Types Handled**:
- `RESEARCH_COMPANY` - Research company request
- `SEARCH_VISA_SPONSOR` - Visa sponsorship search (forwarded to side panel)

**Tab Management**:
```javascript
// Opens URL in background tab
chrome.tabs.create({ url, active: false })

// Injects content extraction script
chrome.scripting.executeScript({
  target: { tabId },
  func: extractionFunction
})

// Closes tab after extraction
chrome.tabs.remove(tabId)
```

---

### 3. Side Panel (`sidepanel.js`)

**Purpose**: Main user interface for displaying job data and AI features.

**Key Functions**:
- `displayJobData()` - Displays job details with highlighting
- `checkVisaSponsorship()` - Searches IndexedDB for visa sponsors
- `generateCoverLetter()` - Generates AI-powered cover letter
- `generateAnswer()` - Generates AI-powered answers to questions
- `researchCompany()` - Triggers company research
- `highlightKeywordsInText()` - Highlights keywords in text

**IndexedDB Operations**:
```javascript
// Open database
openDatabase('VisaSponsorDB', 1)

// Save CSV data
saveToIndexedDB(csvData, metadata)

// Search companies
searchCompaniesInIndexedDB(companyName)

// Get metadata
getMetadataFromIndexedDB()
```

**AI Provider Support**:
- OpenAI (custom API key)
- GitHub Copilot (OAuth authentication)
- Groq (free alternative)
- Hugging Face (free alternative)

---

### 4. Options Page (`options.js`)

**Purpose**: Settings configuration and data management.

**Key Functions**:
- `saveOptions()` - Saves all settings to Chrome Storage
- `loadOptions()` - Loads settings from Chrome Storage
- `handleResumeUpload()` - Parses PDF resume with PDF.js
- `handleCSVUpload()` - Processes CSV file and saves to IndexedDB
- `handleCopilotAuth()` - Initiates GitHub Copilot authentication

**Settings Stored** (Chrome Storage):
```javascript
{
  AI_PROVIDER: 'openai|copilot|groq|huggingface',
  OPENAI_API_KEY: 'sk-...',
  API_ENDPOINT: 'https://...',
  AI_MODEL: 'gpt-4o-mini',
  PROMPT: 'Custom prompt...',
  AUTO_SEND: true|false,
  SEARCH_KEYWORDS: 'kubernetes,docker,python',
  BAD_KEYWORDS: 'Azure,relocation',
  ENABLE_BADGE_SCANNER: true|false,
  ENABLE_VISA_BADGE: true|false,
  BADGE_KEYWORDS: 'kubernetes|#4caf50\ndocker|#2196F3',
  COVER_LETTER_PROMPT: 'Custom prompt...',
  RESUME_TEXT: 'Extracted resume text...',
  APPLICATION_QUESTIONS: 'Question|Prompt\n...',
  COMPANY_RESEARCH_PROMPT: 'Custom prompt...',
  CHARACTER_LIMIT: 1000,
  ENABLE_LINKEDIN: true|false,
  ENABLE_WEBSITE: true|false,
  ENABLE_CUSTOM_URLS: true|false,
  AUTO_RESEARCH: true|false
}
```

---

### 5. Copilot Auth (`copilot-auth.js`)

**Purpose**: GitHub Copilot authentication and API integration.

**Key Functions**:
- `initiateDeviceFlow()` - Starts OAuth device flow
- `pollForToken()` - Polls for user authorization
- `getCopilotToken()` - Gets Copilot API token
- `chat()` - Sends chat request to Copilot API
- `resetConversation()` - Clears conversation history

**Authentication Flow**:
```
1. User clicks "Authenticate with GitHub"
2. Extension calls GitHub device flow API
3. User visits github.com/login/device
4. User enters device code
5. Extension polls for authorization
6. GitHub returns access token
7. Extension exchanges for Copilot token
8. Token stored in Chrome Storage
```

---

## Data Flow

### Job Data Extraction Flow

```
LinkedIn Page
    ↓
Content Script (content.js)
    ├─ MutationObserver detects page change
    ├─ extractJobDetails() extracts job description
    ├─ extractCompanyName() extracts company name
    └─ Sends JOB_DATA_UPDATED message
    ↓
Background Worker (background.js)
    └─ Forwards message to side panel
    ↓
Side Panel (sidepanel.js)
    ├─ displayJobData() shows job details
    ├─ checkVisaSponsorship() searches IndexedDB
    ├─ checkKeywords() checks for keywords
    └─ Highlights keywords in text
```

### Company Research Flow

```
User clicks "Research Company"
    ↓
Side Panel (sidepanel.js)
    └─ Sends RESEARCH_COMPANY message
    ↓
Background Worker (background.js)
    ├─ Opens LinkedIn company page in background tab
    ├─ Injects content extraction script
    ├─ Extracts text with extractTextFromHTML()
    ├─ Closes tab
    ├─ Opens company website in background tab
    ├─ Extracts text
    ├─ Closes tab
    ├─ Opens custom URLs (if any)
    ├─ Extracts text
    ├─ Closes tabs
    ├─ Concatenates all research data
    ├─ Calls AI for summarization (if prompt configured)
    └─ Returns research data to side panel
    ↓
Side Panel (sidepanel.js)
    ├─ Caches research data (24-hour TTL)
    └─ Displays research results
```

### AI Integration Flow

```
User clicks "Send to ChatGPT" / "Generate Cover Letter" / "Generate Answer"
    ↓
Side Panel (sidepanel.js)
    ├─ Loads settings (AI provider, API key, prompt)
    ├─ Replaces variables in prompt
    └─ Calls AI provider
    ↓
AI Provider (OpenAI / Copilot / Groq / HuggingFace)
    ├─ Processes request
    └─ Returns response (streaming or non-streaming)
    ↓
Side Panel (sidepanel.js)
    └─ Displays AI response
```

---

## Storage Architecture

### Chrome Storage (chrome.storage.local)

**Purpose**: Store settings and small data.

**Data Stored**:
- User settings (AI provider, API keys, prompts)
- Resume text (extracted from PDF)
- Application questions
- Company research cache (with TTL)
- GitHub Copilot tokens

**Size Limit**: ~10MB

### IndexedDB

**Purpose**: Store large CSV files (UK visa sponsors).

**Database**: `VisaSponsorDB`

**Object Stores**:
- `companies` - Company records from CSV
- `metadata` - File metadata (filename, upload date, row count)

**Schema**:
```javascript
{
  companies: [
    {
      'Organisation Name': 'Google UK Limited',
      'Town/City': 'London',
      'County': 'Greater London',
      'Type & Rating': 'Worker',
      'Route': 'Skilled Worker'
    },
    // ... more companies
  ],
  metadata: {
    filename: 'visa-sponsors.csv',
    uploadDate: '2024-01-15T10:30:00Z',
    rowCount: 50000
  }
}
```

**Size Limit**: ~50MB+ (browser-dependent)

---

## AI Integration

### Supported Providers

#### 1. OpenAI
- **Endpoint**: `https://api.openai.com/v1/chat/completions`
- **Authentication**: Bearer token (API key)
- **Models**: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
- **Streaming**: Supported

#### 2. GitHub Copilot
- **Endpoint**: `https://api.githubcopilot.com/chat/completions`
- **Authentication**: OAuth device flow → Copilot token
- **Model**: gpt-4o
- **Streaming**: Supported

#### 3. Groq
- **Endpoint**: Custom (configured in options)
- **Authentication**: API key
- **Models**: Various open-source models
- **Streaming**: Supported

#### 4. Hugging Face
- **Endpoint**: Custom (configured in options)
- **Authentication**: API key
- **Models**: Various open-source models
- **Streaming**: Supported

### Variable Replacement

**Available Variables**:
- `{job_title}` - Job title
- `{company_name}` - Company name
- `{job_description}` - Full job description
- `{resume}` - User's resume text
- `{company_research}` - AI-generated company summary
- `{raw_research}` - Raw company research data
- `{company_links}` - List of company URLs

**Replacement Logic**:
```javascript
let prompt = customPrompt
  .replace(/{job_title}/g, jobTitle)
  .replace(/{company_name}/g, companyName)
  .replace(/{job_description}/g, jobDescription)
  .replace(/{resume}/g, resumeText)
  .replace(/{company_research}/g, companyResearch)
  .replace(/{raw_research}/g, rawResearch)
  .replace(/{company_links}/g, companyLinks);
```

---

## Algorithms

### 1. Fuzzy Company Name Matching

**Purpose**: Match company names despite variations.

**Algorithm**: Levenshtein distance + normalization

**Steps**:
1. Normalize both names (lowercase, remove special chars)
2. Extract core name (remove Ltd, Limited, PLC, etc.)
3. For short names (≤5 chars): Require exact match
4. For long names: Use fuzzy matching
5. Score matches:
   - Exact match: 100 points
   - Core exact match: 90 points
   - Starts with: 80 points
   - Contains: 50 points
6. Return top 5 matches sorted by score

**Example**:
```javascript
normalizeCompanyName('Google UK Ltd')
// → 'google uk ltd'

extractCoreCompanyName('Google UK Ltd')
// → 'google uk'

companyNamesMatch('Google', 'Google UK Limited')
// → true (core match)

companyNamesMatch('Teya', 'Teya Technologies')
// → false (short name, no exact match)
```

### 2. Text Extraction (10-Step Process)

**Purpose**: Extract clean text from HTML pages.

**Steps**:
1. Try `og:description` meta tag (highest quality)
2. Try `description` meta tag
3. Remove `<script>` and `<style>` tags
4. Remove HTML comments
5. Remove navigation elements
6. Extract text from body
7. Normalize whitespace
8. Remove excessive newlines
9. Trim text
10. Limit to character count

**Code**:
```javascript
function extractTextFromHTML(html, limit = 1000) {
  // Step 1: Try og:description
  const ogMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
  if (ogMatch) return ogMatch[1].substring(0, limit);
  
  // Step 2-10: Progressive extraction
  // ... (see background.js for full implementation)
}
```

### 3. Keyword Highlighting

**Purpose**: Highlight keywords in text without breaking HTML.

**Algorithm**:
1. Sort keywords by length (longest first)
2. For each keyword:
   - Escape regex special characters
   - Create case-insensitive regex
   - Replace with `<mark>` tag
3. Apply color-coded styles

**Code**:
```javascript
function highlightKeywordsInText(text, keywords, color) {
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  
  for (const keyword of sortedKeywords) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedKeyword})`, 'gi');
    text = text.replace(regex, 
      `<mark style="background-color: ${color}; ...">\$1</mark>`
    );
  }
  
  return text;
}
```

---

## Security

### Data Privacy
- ✅ All data processed locally in browser
- ✅ No external tracking or analytics
- ✅ API keys stored in Chrome Storage (encrypted by Chrome)
- ✅ CSV data stored in IndexedDB (local only)
- ✅ No data sent to third parties (except AI providers)

### API Key Security
- Stored in `chrome.storage.local` (encrypted by Chrome)
- Never logged or exposed in console
- Only sent to configured AI provider
- User can delete at any time

### Content Security Policy
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### Permissions
```json
{
  "permissions": [
    "sidePanel",    // Open side panel
    "scripting",    // Inject scripts for content extraction
    "activeTab",    // Access active tab
    "storage",      // Store settings
    "tabs"          // Manage tabs
  ],
  "host_permissions": [
    "https://www.linkedin.com/*",
    "https://api.openai.com/*",
    "https://github.com/*",
    "https://api.githubcopilot.com/*",
    "http://*/*",   // For company research
    "https://*/*"   // For company research
  ]
}
```

---

## Performance Optimizations

### 1. Debouncing
- MutationObserver callbacks debounced (500ms)
- Prevents excessive processing on rapid page changes

### 2. Caching
- Company research cached for 24 hours
- Reduces redundant API calls and tab openings

### 3. Background Processing
- Badge scanner runs in background
- Progressive loading of job cards
- Non-blocking UI updates

### 4. Lazy Loading
- Job text expandable ("Read more")
- Reduces initial render time

### 5. Abort Controllers
- AI requests can be canceled
- Prevents wasted API calls

---

For more information, see:
- [FEATURES.md](FEATURES.md) - Complete feature list
- [README.md](../README.md) - Main documentation
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guide

