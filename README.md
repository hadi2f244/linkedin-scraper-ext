# LinkedIn Job Scraper & AI Analyzer 🚀

**Automatically** analyze LinkedIn jobs with AI summaries, UK visa sponsorship checks, and keyword matching — all in a convenient side panel!

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## ✨ Key Features

🎯 **Auto-Scraping** — Side panel opens automatically, updates in real-time as you browse jobs
🔍 **Visa Sponsorship** — Check UK work visa eligibility instantly (supports 12MB+ CSV files)
🎯 **Keyword Highlighting** — Highlight keywords directly on LinkedIn page and in side panel
🏷️ **Badge Scanner** — Auto-scan job listings and display colored badges for quick filtering
🤖 **AI Summaries** — Get structured job analysis via OpenAI, GitHub Copilot, Groq, or Hugging Face
📄 **Cover Letter Generator** — AI-powered cover letters tailored to each job
❓ **Q&A Auto-Responder** — Generate answers to application questions automatically
🏢 **Company Research** — Auto-research companies with AI-powered summaries
⚡ **Smart Matching** — Fuzzy algorithm handles company name variations and abbreviations

---

## 🎬 Quick Demo

1. Browse LinkedIn jobs → Side panel opens automatically
2. Click any job → Instant results:
   - 🏷️ **Badges on job cards** - "kubernetes", "docker", "Visa Sponsor"
   - 🎨 **Keywords highlighted** - Green for good, orange for bad, directly on LinkedIn page
   - ✅ **Visa sponsor?** "Barclays - Found in UK register!"
   - ✅ **Keywords?** "kubernetes ✅, python ✅, gcp ❌"
   - 🤖 **AI Summary** "Skills: 5+ years DevOps, AWS, Terraform..."
   - 📄 **Cover Letter** - Generate tailored cover letter with one click
   - ❓ **Q&A** - Auto-answer "Why do you want to work here?"
   - 🏢 **Company Research** - AI-powered company analysis

---

## 🚀 Quick Start

### 1. Install

```bash
git clone https://github.com/hadi2f244/linkedin-scraper-ext
```

1. Open `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load unpacked** → Select folder
4. Done! 🎉

### 2. Configure (2 minutes)

Right-click extension → **Options**:

**🔧 General Tab:**
- **AI Provider**: Choose OpenAI, GitHub Copilot, Groq, or Hugging Face
- **API Key** (if using OpenAI): Add your OpenAI API key
- **Keywords**: `kubernetes, CI/CD, python, aws, docker`
- **Bad Keywords**: `Azure, relocation required, on-site only`
- **Badge Keywords**: `kubernetes|#4caf50` (one per line)
- **CSV File**: [Download UK Visa Sponsors CSV](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers)

**📄 Cover Letter Tab:**
- Upload your resume (PDF)
- Customize cover letter prompt template

**❓ Q&A Tab:**
- Add common application questions
- Configure AI prompts for each question

**🏢 Company Research Tab:**
- Customize research prompt
- Enable/disable data sources
- Configure auto-research

### 3. Use It!

1. Go to [LinkedIn Jobs](https://www.linkedin.com/jobs/)
2. Click any job
3. Check side panel for instant analysis! ✨

---

## 📸 Screenshots

### Side Panel in Action
*Automatic visa check, keyword matching, and AI summary*

![Side Panel](readme/sidepanel-example.jpg)

### Visa Sponsorship Results
*Instant verification with match quality indicators*

![Visa Check](readme/visa-check-example.jpg)

---

## 🎯 Example Output

```
🔍 Visa Sponsorship Check
Searched: Google UK
✅ Found in UK visa sponsorship register!
[Exact Match] Google UK Ltd - London - Skilled Worker

Keyword Search Results:
✅ kubernetes
✅ python
✅ CI/CD
❌ golang

AI Summary:
1. Skills: 5+ years DevOps, Kubernetes, Python, AWS, Terraform
2. Salary: £80,000-£120,000 (estimated UK market rate)
3. Location: London (Hybrid - 2 days/week office)
4. Visa: Sponsorship available
```

---

## 📚 Documentation

- **[Complete Feature List](docs/FEATURES.md)** — Comprehensive overview of all features
- **[Full Documentation](docs/README.md)** — Complete guide with all features
- **[Installation Guide](docs/installation.md)** — Detailed setup instructions
- **[Visa Sponsorship Guide](docs/visa-sponsorship.md)** — How the checker works
- **[GitHub Copilot Integration](docs/copilot-integration.md)** — Setup guide for Copilot
- **[Prompt Examples](docs/prompt-examples.md)** — Example prompts for AI features
- **[Troubleshooting](docs/troubleshooting.md)** — Common issues and solutions
- **[Contributing](docs/CONTRIBUTING.md)** — How to contribute to the project

---

## 🛠️ Tech Stack

- **Chrome Extension** (Manifest V3)
- **Side Panel API** - Modern Chrome extension UI
- **IndexedDB** - Large CSV storage (12MB+)
- **AI Integration** - OpenAI, GitHub Copilot, Groq, Hugging Face
- **PDF.js** - Resume parsing and PDF generation
- **Fuzzy Matching** - Levenshtein distance algorithm
- **MutationObserver** - Real-time page monitoring
- **OAuth Device Flow** - GitHub Copilot authentication

---

## 🔒 Privacy

✅ All data processed locally  
✅ No tracking or analytics  
✅ API key stored securely in Chrome  
✅ CSV data stays in your browser  

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](docs/CONTRIBUTING.md)

---

## 📝 License

MIT — Free to use, modify, and share

---

## 🙏 Credits

Original concept: [Anton Dolganin](https://www.linkedin.com/in/antonds/)

Enhanced with side panel, visa checker, keyword search, and auto-updates.

---

**⭐ Star this repo if you find it useful!**

**Happy job hunting! 🎯**

