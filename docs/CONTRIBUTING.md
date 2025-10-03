# Contributing Guide

Thank you for considering contributing to the LinkedIn Job Scraper & AI Analyzer! 🎉

---

## Table of Contents

1. [Ways to Contribute](#ways-to-contribute)
2. [Reporting Bugs](#reporting-bugs)
3. [Suggesting Features](#suggesting-features)
4. [Code Contributions](#code-contributions)
5. [Documentation](#documentation)
6. [Testing](#testing)
7. [Code Style](#code-style)

---

## Ways to Contribute

### 🐛 Report Bugs
Found a bug? Let us know! See [Reporting Bugs](#reporting-bugs)

### 💡 Suggest Features
Have an idea? We'd love to hear it! See [Suggesting Features](#suggesting-features)

### 💻 Write Code
Fix bugs or implement features. See [Code Contributions](#code-contributions)

### 📚 Improve Documentation
Help others understand the extension better

### 🧪 Test & Review
Test new features and review pull requests

### 🌍 Translate
Help make the extension available in other languages (future)

---

## Reporting Bugs

### Before Reporting

1. **Check existing issues:** Someone might have already reported it
2. **Try latest version:** Bug might be fixed already
3. **Check troubleshooting:** See [troubleshooting.md](troubleshooting.md)

### How to Report

**Open a GitHub issue with:**

1. **Clear title:** "Company name not detected on LinkedIn job page"
2. **Description:** What happened vs what you expected
3. **Steps to reproduce:**
   ```
   1. Go to LinkedIn jobs
   2. Click on job from Company X
   3. Side panel opens but company name field is empty
   ```
4. **Environment:**
   - Chrome version: `chrome://version/`
   - Extension version
   - Operating system
5. **Console logs:**
   - F12 → Console
   - Filter by "LinkedIn Scraper"
   - Screenshot or copy relevant logs
6. **Screenshots:** If applicable
7. **Job URL:** If issue is job-specific (remove if private)

### Bug Report Template

```markdown
**Bug Description:**
[Clear description of the bug]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Environment:**
- Chrome Version: 
- Extension Version: 
- OS: 

**Console Logs:**
```
[Paste logs here]
```

**Screenshots:**
[If applicable]

**Additional Context:**
[Any other relevant information]
```

---

## Suggesting Features

### Before Suggesting

1. **Check existing issues:** Feature might be planned
2. **Consider scope:** Does it fit the extension's purpose?
3. **Think about users:** Would others benefit?

### How to Suggest

**Open a GitHub issue with:**

1. **Clear title:** "Feature: Add support for German visa sponsorship"
2. **Problem statement:** What problem does this solve?
3. **Proposed solution:** How would it work?
4. **Alternatives:** Other ways to solve the problem
5. **Use cases:** When would you use this?
6. **Mockups:** If applicable (screenshots, diagrams)

### Feature Request Template

```markdown
**Feature Description:**
[Clear description of the feature]

**Problem it Solves:**
[What problem does this address?]

**Proposed Solution:**
[How would this feature work?]

**Use Cases:**
1. 
2. 
3. 

**Alternatives Considered:**
[Other ways to solve this]

**Additional Context:**
[Mockups, examples, etc.]
```

---

## Code Contributions

### Getting Started

1. **Fork the repository**
2. **Clone your fork:**
   ```bash
   git clone https://github.com/yourusername/linkedin-scraper-ext
   cd linkedin-scraper-ext
   ```
3. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Development Setup

1. **Load extension in Chrome:**
   - Go to `chrome://extensions/`
   - Enable Developer Mode
   - Load unpacked → Select folder

2. **Make changes:**
   - Edit files
   - Reload extension to test
   - Check console for errors

3. **Test thoroughly:**
   - Test on multiple LinkedIn jobs
   - Test edge cases
   - Check console for errors

### Making Changes

#### File Structure

```
linkedin-scraper-ext/
├── manifest.json          # Extension config
├── background.js          # Service worker
├── content.js            # LinkedIn scraper
├── sidepanel.html        # UI
├── sidepanel.js          # UI logic
├── sidepanel.css         # Styling
├── options.html          # Settings UI
├── options.js            # Settings logic
└── docs/                 # Documentation
```

#### Key Components

**content.js:**
- Runs on LinkedIn pages
- Extracts job data
- Detects company names
- Sends messages to side panel

**sidepanel.js:**
- Receives job data
- Searches IndexedDB
- Displays results
- Handles ChatGPT API

**background.js:**
- Routes messages
- Opens side panel
- Manages extension lifecycle

### Coding Guidelines

#### JavaScript Style

**Use modern ES6+:**
```javascript
// ✅ Good
const extractCompanyName = () => {
  const element = document.querySelector('.company-name');
  return element?.textContent?.trim() || null;
};

// ❌ Avoid
var extractCompanyName = function() {
  var element = document.querySelector('.company-name');
  if (element && element.textContent) {
    return element.textContent.trim();
  }
  return null;
};
```

**Use async/await:**
```javascript
// ✅ Good
const loadData = async () => {
  const data = await fetchData();
  return processData(data);
};

// ❌ Avoid
const loadData = () => {
  return fetchData().then(data => {
    return processData(data);
  });
};
```

**Error handling:**
```javascript
// ✅ Good
try {
  const result = await riskyOperation();
  console.log('Success:', result);
} catch (error) {
  console.error('Error:', error);
  showUserError('Operation failed');
}

// ❌ Avoid
const result = await riskyOperation(); // No error handling
```

#### Console Logging

**Use prefixes for filtering:**
```javascript
// ✅ Good
console.log('[LinkedIn Scraper] Company name found:', name);
console.error('[LinkedIn Scraper] Failed to extract:', error);

// ❌ Avoid
console.log('Company name:', name);
```

**Log levels:**
- `console.log()` - Normal operation
- `console.warn()` - Warnings, fallbacks
- `console.error()` - Errors, failures

#### Comments

**Explain WHY, not WHAT:**
```javascript
// ✅ Good
// Wait for company name element to load (LinkedIn loads it dynamically)
await waitForElement('.company-name');

// ❌ Avoid
// Wait for element
await waitForElement('.company-name');
```

**Document complex logic:**
```javascript
/**
 * Matches company names with fuzzy logic
 * Handles variations like "Google" vs "Google UK Limited"
 * 
 * @param {string} searchName - Name to search for
 * @param {string} csvName - Name from CSV
 * @returns {number} Match score (0-100)
 */
const scoreMatch = (searchName, csvName) => {
  // Implementation...
};
```

### Testing Your Changes

#### Manual Testing Checklist

- [ ] Extension loads without errors
- [ ] Side panel opens on LinkedIn jobs
- [ ] Company name detected correctly
- [ ] Visa check works (if applicable)
- [ ] Keywords work (if applicable)
- [ ] ChatGPT integration works (if applicable)
- [ ] No console errors
- [ ] Works on multiple jobs
- [ ] Edge cases handled

#### Test Cases

**Company Name Detection:**
- Jobs with standard company names
- Jobs with long company names
- Jobs with special characters
- Jobs from recruiters
- Sponsored jobs

**Visa Sponsorship:**
- Exact matches
- Partial matches
- No matches
- Short company names (≤5 chars)
- Long company names

**Keywords:**
- All keywords found
- Some keywords found
- No keywords found
- Case variations
- Special characters

### Submitting Changes

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: Add support for German visa sponsorship"
   ```

2. **Commit message format:**
   ```
   type: Short description

   Longer description if needed

   Fixes #123
   ```

   **Types:**
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation
   - `style:` Formatting
   - `refactor:` Code restructuring
   - `test:` Tests
   - `chore:` Maintenance

3. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create Pull Request:**
   - Go to GitHub
   - Click "New Pull Request"
   - Fill in template
   - Link related issues

### Pull Request Template

```markdown
**Description:**
[What does this PR do?]

**Related Issue:**
Fixes #123

**Changes:**
- 
- 
- 

**Testing:**
- [ ] Tested on multiple LinkedIn jobs
- [ ] No console errors
- [ ] Edge cases handled
- [ ] Documentation updated

**Screenshots:**
[If applicable]

**Checklist:**
- [ ] Code follows style guidelines
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

---

## Documentation

### What to Document

- New features
- API changes
- Configuration options
- Troubleshooting steps
- Examples

### Where to Document

- **README.md** - Quick start, overview
- **docs/README.md** - Detailed documentation
- **docs/[topic].md** - Specific topics
- **Code comments** - Complex logic
- **Commit messages** - What and why

### Documentation Style

- Clear, concise language
- Step-by-step instructions
- Code examples
- Screenshots where helpful
- Links to related docs

---

## Code Review Process

### For Contributors

1. **Be patient:** Reviews take time
2. **Be responsive:** Address feedback promptly
3. **Be open:** Consider suggestions
4. **Ask questions:** If feedback unclear

### For Reviewers

1. **Be respectful:** Constructive feedback
2. **Be specific:** Point to exact lines
3. **Be helpful:** Suggest solutions
4. **Be timely:** Review within a week

---

## Questions?

- **General questions:** Open a GitHub discussion
- **Bug reports:** Open an issue
- **Feature requests:** Open an issue
- **Code questions:** Comment on PR

---

**Thank you for contributing! 🙏**

