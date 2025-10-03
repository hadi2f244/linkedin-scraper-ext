# LinkedIn Job Scraper & AI Analyzer

🚀 **Automatically** scrape LinkedIn job postings, check UK visa sponsorship status, search for keywords, and get AI-powered summaries — all in a convenient side panel!

---

## ✨ Features

### 🎯 **Automatic Job Scraping**
- **Side panel** opens automatically when you browse LinkedIn jobs
- **Real-time updates** as you click through different job listings
- **No manual clicking** required — just browse jobs naturally
- Clean, normalized text extraction with "Read more" expandable view

### 🔍 **UK Visa Sponsorship Checker**
- **Upload UK government CSV** with licensed visa sponsors (12MB+ supported via IndexedDB)
- **Automatic company detection** from job postings
- **Smart matching algorithm** handles company name variations and abbreviations
- **Instant verification** — see if the company can sponsor work visas
- **Detailed information** including location, rating, and sponsorship routes
- **Match quality indicators** (Exact Match, High Match, Possible Match)
- **Manual search option** if company name isn't auto-detected
- **Top 5 results** sorted by relevance

### 🎯 **Keyword Search**
- Define **custom keywords** to search for in job descriptions
- Instant **visual feedback** (✅ found / ❌ not found)
- Perfect for checking required skills: CI/CD, Kubernetes, Python, AWS, etc.
- Each keyword displayed on its own line with color coding

### 🤖 **AI-Powered Summaries**
- **ChatGPT integration** for intelligent job analysis
- **Custom prompts** for personalized summaries
- **Auto-send option** or manual control
- **Stop/Cancel** requests mid-flight
- Structured, concise summaries tailored to your needs

### 📱 **Modern UI**
- **Side panel interface** — always accessible while browsing
- **Expandable job text** with "Read more" functionality
- **Color-coded results** for quick scanning
- **Professional design** with LinkedIn branding
- **Responsive layout** that works seamlessly

---

## 🎬 How It Works

1. **Install the extension** (see Setup below)
2. **Configure settings** (API key, keywords, upload CSV)
3. **Browse LinkedIn jobs** — side panel opens automatically
4. **Click on any job** — data loads instantly in real-time
5. **See results:**
   - 🔍 Visa sponsorship status (if CSV uploaded)
   - ✅ Keyword matches
   - 🤖 AI summary (if auto-send enabled)
6. **Review full job text** with expandable "Read more" section
7. **Manual controls** available for refresh and re-analysis

---

## 🚀 Setup

### Installation

```bash
git clone https://github.com/yourusername/linkedin-scraper-ext
```

1. Open `chrome://extensions/`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked**
4. Select the extension folder
5. The extension icon should appear in your toolbar

### Configuration

#### 1. **OpenAI API Key** (Required for AI summaries)
- Right-click extension icon → **Options**
- Enter your OpenAI API key
- Or add a `prompt.txt` file in the root folder

#### 2. **Custom Prompt** (Optional)
- Configure your preferred summary format
- See example prompt below

#### 3. **Keywords** (Optional)
- Add comma-separated keywords to search for
- Example: `kubernetes, CI/CD, python, aws, docker, terraform`

#### 4. **Auto-send to ChatGPT** (Optional)
- Check the box to automatically send jobs to ChatGPT
- Uncheck for manual control (default: unchecked)

#### 5. **UK Visa Sponsorship CSV** (Optional but recommended)
- Download from: [UK Government - Register of Licensed Sponsors](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers)
- Look for "Worker and Temporary Worker" CSV file
- Upload via Options page
- File is stored locally in IndexedDB (supports 12MB+ files)

---

## 📖 Usage Guide

### Automatic Mode (Recommended)

1. Navigate to [LinkedIn Jobs](https://www.linkedin.com/jobs/)
2. Side panel opens automatically
3. Click on any job listing
4. Results appear instantly:
   - Company name auto-detected
   - Visa sponsorship check runs
   - Keywords highlighted
   - AI summary generated (if auto-send enabled)

### Manual Mode

1. Click **Refresh Job Data** to reload current job
2. Enter company name manually if not detected
3. Click **Check Visa** to search sponsorship database
4. Click **Send to ChatGPT** to get AI summary
5. Click **Stop ChatGPT** to cancel ongoing requests

### Reading Job Details

- Job text preview shows first ~150px
- Click **Read more ▼** to expand full text
- Click **Read less ▲** to collapse

---

## 🎯 Example Prompt

```text
I will send you a job description text.
Your task is to make a short summary in a strictly structured form (numbered list):

1. Skills — key technologies, programming languages, experience, soft skills (only from the text).
2. Salary — specify if mentioned. If not, estimate the range based on the market/country.
3. Education — only if explicitly required.
4. Language — level/requirement, if mentioned.
5. Work format and location — office/hybrid/remote, country/city, citizenship requirements (if mentioned).

Important:
• Write as briefly as possible, one line per item.
• No extra words or comments.
• If there is no information in the job description — skip the item (do not write "no data").

Answer in English.

Job description:
```

---

## 🔍 Visa Sponsorship Feature Details

### How It Works

1. **CSV Upload**: Upload the official UK government CSV file containing all licensed sponsors
2. **Storage**: File is stored in browser's IndexedDB (no size limits, unlike chrome.storage)
3. **Company Detection**: Extension automatically extracts company name from LinkedIn job posting
4. **Smart Matching**: Advanced algorithm matches company names including:
   - Exact matches
   - Variations (e.g., "IBM" matches "IBM United Kingdom Limited")
   - Abbreviations
   - Different suffixes (Ltd, Limited, PLC, etc.)
5. **Results Display**: Shows top 5 matches with quality indicators

### Match Quality Indicators

- 🟢 **Exact Match** — Perfect match (score ≥ 90)
- 🟡 **High Match** — Very likely correct (score ≥ 80)
- 🔵 **Possible Match** — Might be correct (score < 80)

### Example Results

```
🔍 Visa Sponsorship Check
Searched: Barclays
✅ Found 3 matches in UK visa sponsorship register!
Showing top 3 matches sorted by relevance

[Exact Match]
Organisation: Barclays
Town/City: London
County: Greater London
Type & Rating: Worker (A rating)
Route: Skilled Worker

[High Match]
Organisation: Barclays Bank PLC
Town/City: Manchester
County: Greater Manchester
Type & Rating: Worker (A rating)
Route: Global Business Mobility: Senior or Specialist Worker
```

---

## 🛠️ Technical Details

### Architecture

- **Manifest V3** Chrome Extension
- **Side Panel API** for persistent UI
- **Content Script** for LinkedIn page interaction
- **Background Service Worker** for message routing
- **IndexedDB** for large CSV storage
- **Chrome Storage** for settings

### Files Structure

```
linkedin-scraper-ext/
├── manifest.json          # Extension configuration
├── background.js          # Service worker
├── content.js            # LinkedIn page scraper
├── sidepanel.html        # Side panel UI
├── sidepanel.js          # Side panel logic
├── sidepanel.css         # Styling
├── options.html          # Settings page
├── options.js            # Settings logic
└── prompt.txt           # Default prompt (optional)
```

### Permissions

- `sidePanel` — Side panel UI
- `scripting` — Inject content scripts
- `activeTab` — Access current tab
- `storage` — Save settings
- `tabs` — Tab management
- Host permissions for LinkedIn and ChatGPT API

---

## 🐛 Troubleshooting

### Company Name Not Detected

1. Open browser console (F12) on LinkedIn page
2. Filter logs by "LinkedIn Scraper"
3. Check which selector is being used
4. Use manual input field as fallback

### CSV Upload Fails

- Error: "Resource::kQuotaBytes quota exceeded"
  - **Fixed!** Now uses IndexedDB instead of chrome.storage
  - Supports files 12MB+ without issues

### Visa Check Shows Wrong Companies

- The matching algorithm is strict for short names (≤5 characters)
- For "Teya", only matches companies with core name exactly "Teya"
- Won't match "Teya Technologies" or "Teya Systems"

### AI Summary Not Working

1. Check API key in Options
2. Verify prompt is configured
3. Check browser console for errors
4. Try clicking "Stop ChatGPT" and retry

---

## 🔒 Privacy & Security

- ✅ **No data collection** — everything runs locally
- ✅ **No external servers** — except ChatGPT API (optional)
- ✅ **API key stored locally** — in Chrome's secure storage
- ✅ **CSV data stored locally** — in browser's IndexedDB
- ✅ **No tracking** — no analytics or telemetry

---

## 📝 License

MIT — free to use, hack, and share.

---

## 🙏 Credits

Original concept by [Anton Dolganin](https://www.linkedin.com/in/antonds/)

Enhanced with:
- Side panel interface
- UK visa sponsorship checker
- Keyword search
- Auto-send functionality
- Advanced company name matching
- IndexedDB storage for large files

---

## 🤝 Contributing

Contributions welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

---

## 📞 Support

If you encounter issues:
1. Check the Troubleshooting section
2. Review browser console logs
3. Open an issue on GitHub

---

**Happy job hunting! 🎯**

