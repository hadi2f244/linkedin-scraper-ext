# Complete Feature List

This document provides a comprehensive overview of all features available in the LinkedIn Job Scraper & AI Analyzer extension.

---

## 📋 Table of Contents

1. [Core Features](#core-features)
2. [AI Integration](#ai-integration)
3. [Keyword Features](#keyword-features)
4. [Company Research](#company-research)
5. [Cover Letter Generation](#cover-letter-generation)
6. [Application Q&A](#application-qa)
7. [Badge Scanner](#badge-scanner)
8. [Visa Sponsorship Checker](#visa-sponsorship-checker)

---

## Core Features

### 1. Automatic Job Scraping
- **Real-time extraction** of job details from LinkedIn
- **Side panel auto-opens** when browsing LinkedIn jobs
- **MutationObserver** monitors page changes
- **Intelligent text extraction** with 10-step processing:
  - Prioritizes `og:description` meta tags
  - Removes navigation elements
  - Filters HTML comments
  - Normalizes whitespace
  - Preserves readability

### 2. Multi-Tab Interface
- **📋 Job Details** - View job description, keywords, visa status
- **📄 Cover Letter** - Generate AI-powered cover letters
- **❓ Q&A** - Auto-answer application questions
- **🏢 Company Research** - Research companies automatically

### 3. Data Persistence
- **IndexedDB storage** for large CSV files (12MB+)
- **Chrome Storage** for settings and preferences
- **24-hour cache** for company research data
- **Local processing** - all data stays in your browser

---

## AI Integration

### Supported AI Providers

#### 1. OpenAI (Custom API Key)
- **Models**: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
- **Custom endpoints** supported for proxies
- **Streaming responses** for real-time output
- **Configurable temperature** and max tokens

#### 2. GitHub Copilot (Free with Subscription)
- **OAuth authentication** via device flow
- **Token management** with automatic refresh
- **Model**: gpt-4o
- **Streaming support** for real-time responses
- **Session management** with conversation reset

#### 3. Groq (Free Alternative)
- **Free tier** available globally
- **Fast inference** speeds
- **Multiple models** supported
- **No credit card** required

#### 4. Hugging Face (Free Alternative)
- **Open-source models** available
- **Free tier** for testing
- **Community-driven** model selection

### AI Features
- **Job summaries** - Structured analysis of job descriptions
- **Cover letter generation** - Tailored to job and resume
- **Question answering** - Auto-respond to application questions
- **Company research** - AI-powered company analysis
- **Variable replacement** - Dynamic content insertion
- **Abort support** - Cancel long-running requests

---

## Keyword Features

### 1. Keyword Search (Good Keywords)
- **Comma-separated** keyword list
- **Case-insensitive** matching
- **Visual indicators**: ✅ found, ❌ not found
- **Highlighting** in job description (both side panel and LinkedIn page)
- **Color**: Green (#4caf50)

### 2. Bad Keywords (Keywords to Avoid)
- **Inverse logic**: ✅ not found (good), ❌ found (bad)
- **Comma-separated** keyword list
- **Visual indicators** for quick filtering
- **Highlighting** in job description
- **Color**: Orange (#ff9800)

### 3. Text Highlighting
- **Side panel highlighting** - Keywords highlighted in expandable job text
- **LinkedIn page highlighting** - Keywords highlighted directly on LinkedIn
- **Multiple keyword types**:
  - Badge keywords (custom colors)
  - Visa keywords (red #f44336)
  - Search keywords (green #4caf50)
  - Bad keywords (orange #ff9800)
- **Smart matching** - Avoids partial matches
- **Regex-based** - Handles special characters
- **Priority system** - Prevents overlapping highlights

---

## Company Research

### Data Sources
1. **LinkedIn Company Page** - Company overview, description
2. **Company Website** - About page, mission, values
3. **Custom URLs** - Add specific pages to research

### Features
- **Tab-based extraction** - Opens URLs in background tabs
- **Intelligent content extraction** - 10-step processing
- **Character limits** - Configurable per source (500-5000 chars)
- **24-hour caching** - Reduces redundant requests
- **Manual content fallback** - Paste content if auto-extraction fails
- **Force refresh** - Invalidate cache and re-research

### AI-Powered Summarization
- **Custom prompts** - Define your own research questions
- **Variable support**:
  - `{company_name}` - Company name
  - `{job_title}` - Job title
  - `{job_description}` - Full job description
  - `{company_links}` - List of URLs for AI to browse
  - `{raw_research}` - Raw scraped data
- **AI provider selection** - Works with all supported AI providers
- **{company_research} variable** - Use AI summary in Q&A prompts

### Auto-Research
- **Automatic trigger** - Research company when job loads
- **Configurable** - Enable/disable in settings
- **Smart caching** - Uses cached data when available

---

## Cover Letter Generation

### Features
- **AI-powered** - Uses selected AI provider
- **Custom prompts** - Define your own template
- **Variable replacement**:
  - `{job_title}` - Job title
  - `{company_name}` - Company name
  - `{job_description}` - Full job description
  - `{resume}` - Your uploaded resume text
- **PDF resume upload** - Automatically extracts text
- **Editable output** - Edit generated cover letter before saving
- **PDF export** - Save as PDF with automatic filename
- **Copy to clipboard** - Quick copy functionality

### Workflow
1. Upload resume in Options (one-time setup)
2. Configure cover letter prompt template
3. Browse LinkedIn jobs
4. Click "Generate Cover Letter" in side panel
5. Review and edit generated letter
6. Save as PDF or copy to clipboard

---

## Application Q&A

### Features
- **Pre-configured questions** - Common application questions
- **Custom questions** - Add your own questions
- **AI-powered answers** - Generate tailored responses
- **Variable support**:
  - `{job_title}` - Job title
  - `{company_name}` - Company name
  - `{job_description}` - Full job description
  - `{resume}` - Your uploaded resume text
  - `{company_research}` - AI-generated company summary
- **Table interface** - Easy question management
- **Add/Delete** - Manage questions dynamically

### Example Questions
- "Why do you want to work here?"
- "What are your salary expectations?"
- "Why are you a good fit for this role?"
- "What are your strengths and weaknesses?"

### Workflow
1. Configure questions in Options
2. Browse LinkedIn jobs
3. Switch to Q&A tab in side panel
4. Click "Generate Answer" for each question
5. Review and copy answers

---

## Badge Scanner

### Features
- **Automatic scanning** - Scans job listings in left panel
- **Background processing** - Non-blocking, progressive scan
- **Custom keywords** - Define your own badge keywords
- **Color coding** - Assign colors to each keyword
- **Visa sponsorship badge** - Automatic visa keyword detection
- **Badge format**: `keyword|#hexcolor`

### Badge Types
1. **Custom Keywords** - User-defined (e.g., "kubernetes|#4caf50")
2. **Visa Sponsorship** - Automatic detection (red #f44336)

### Visa Keywords Detected
- visa sponsorship
- visa sponsor
- sponsorship available
- will sponsor
- can sponsor
- sponsorship provided
- h1b, h-1b
- work authorization
- right to work

### Workflow
1. Enable badge scanner in Options
2. Add badge keywords (format: `keyword|color`)
3. Browse LinkedIn jobs
4. Badges appear automatically on job cards
5. Filter jobs visually by badges

---

## Visa Sponsorship Checker

### Features
- **UK government CSV** - Official register of licensed sponsors
- **12MB+ file support** - IndexedDB storage
- **Fuzzy matching algorithm** - Handles company name variations
- **Smart scoring system** - Ranks matches by relevance
- **Top 5 results** - Shows best matches
- **Match quality indicators**:
  - **Exact Match** (Score ≥ 90) - Perfect match
  - **High Match** (Score ≥ 80) - Very likely correct
  - **Possible Match** (Score < 80) - Might be correct
- **Manual search** - Edit company name and re-search
- **Detailed information** - Shows town/city, route, worker type

### Matching Algorithm
1. **Normalization** - Lowercase, remove special characters
2. **Core extraction** - Remove Ltd, Limited, PLC, etc.
3. **Strict short names** - Exact match for names ≤5 chars
4. **Flexible long names** - Fuzzy match for longer names
5. **Scoring system**:
   - Exact match: 100 points
   - Core exact match: 90 points
   - Starts with: 80 points
   - Contains: 50 points

### Example Matches
- "Google" → "Google UK Limited" ✅ (Exact Match)
- "IBM" → "IBM United Kingdom Limited" ✅ (High Match)
- "Teya" → "Teya" ✅ (Exact Match, NOT "Teya Technologies")

### CSV File
- **Source**: [UK Government Register](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers)
- **Format**: CSV with columns: Organisation Name, Town/City, County, Type & Rating, Route
- **Update frequency**: Monthly (check government website)

---

## Additional Features

### Privacy & Security
- ✅ **All data processed locally** - No external tracking
- ✅ **API keys stored securely** - Chrome Storage API
- ✅ **CSV data stays in browser** - IndexedDB
- ✅ **No analytics** - No user tracking
- ✅ **Open source** - Transparent code

### Performance
- **Debounced updates** - Prevents excessive processing
- **Background scanning** - Non-blocking badge scanner
- **Cached research** - 24-hour TTL reduces API calls
- **Lazy loading** - Content loaded on demand
- **Abort controllers** - Cancel long-running requests

### User Experience
- **Tab-based navigation** - Organized interface
- **Expandable job text** - "Read more" functionality
- **Loading indicators** - Visual feedback
- **Error handling** - Graceful error messages
- **Success notifications** - Confirmation messages
- **Keyboard shortcuts** - Quick navigation

---

## Coming Soon

- [ ] Multi-language support
- [ ] Export job data to CSV
- [ ] Job comparison tool
- [ ] Salary insights
- [ ] Application tracking
- [ ] Browser notifications

---

For detailed usage instructions, see [README.md](../README.md) and [docs/README.md](README.md).

