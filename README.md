# LinkedIn Job Scraper & AI Analyzer 🚀

**Automatically** analyze LinkedIn jobs with AI summaries, UK visa sponsorship checks, and keyword matching — all in a convenient side panel!

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## ✨ Key Features

🎯 **Auto-Scraping** — Side panel opens automatically, updates in real-time as you browse jobs  
🔍 **Visa Sponsorship** — Check UK work visa eligibility instantly (supports 12MB+ CSV files)  
🎯 **Keyword Search** — Highlight must-have skills (CI/CD, Kubernetes, Python, etc.)  
🤖 **AI Summaries** — Get structured job analysis via ChatGPT  
⚡ **Smart Matching** — Handles company name variations and abbreviations  

---

## 🎬 Quick Demo

1. Browse LinkedIn jobs → Side panel opens automatically
2. Click any job → Instant results:
   - ✅ **Visa sponsor?** "Barclays - Found in UK register!"
   - ✅ **Keywords?** "kubernetes ✅, python ✅, gcp ❌"
   - 🤖 **AI Summary** "Skills: 5+ years DevOps, AWS, Terraform..."

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

- **API Key** (optional): Add OpenAI key for AI summaries
- **Keywords** (optional): `kubernetes, CI/CD, python, aws, docker`
- **CSV File** (optional): [Download UK Visa Sponsors CSV](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers)
- **Auto-send** (optional): Check to auto-generate AI summaries

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

- **[Full Documentation](docs/README.md)** — Complete guide with all features
- **[Installation Guide](docs/installation.md)** — Detailed setup instructions
- **[Visa Sponsorship Guide](docs/visa-sponsorship.md)** — How the checker works
- **[Troubleshooting](docs/troubleshooting.md)** — Common issues and solutions
- **[API Reference](docs/api-reference.md)** — Technical details

---

## 🛠️ Tech Stack

- Chrome Extension (Manifest V3)
- Side Panel API
- IndexedDB (for large CSV storage)
- ChatGPT API integration
- Smart fuzzy matching algorithm

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

