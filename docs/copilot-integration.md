# GitHub Copilot Integration Guide

This extension now supports **GitHub Copilot** as a free alternative to OpenAI's API! This means you can use the AI features without needing to pay for OpenAI API credits.

---

## 🎯 What is GitHub Copilot?

GitHub Copilot is GitHub's AI-powered coding assistant. While primarily designed for code completion, it also provides access to powerful language models that can be used for text generation tasks like job analysis and cover letter writing.

---

## ✅ Prerequisites

To use GitHub Copilot with this extension, you need:

1. **A GitHub account** with Copilot access
2. **Active GitHub Copilot subscription** (one of the following):
   - GitHub Copilot Individual subscription ($10/month)
   - GitHub Copilot Business (through your organization)
   - Free access through GitHub Education (for students/teachers)
   - Free access through GitHub Sponsors

### How to Get GitHub Copilot Access

**Option 1: Individual Subscription**
- Visit [GitHub Copilot](https://github.com/features/copilot)
- Sign up for a subscription ($10/month)
- 30-day free trial available

**Option 2: GitHub Education (Free for Students)**
- Visit [GitHub Education](https://education.github.com/)
- Verify your student/teacher status
- Get free access to GitHub Copilot

**Option 3: Through Your Organization**
- Check if your company provides GitHub Copilot Business
- Contact your IT department or GitHub admin

---

## 🔧 Setup Instructions

### Step 1: Choose AI Provider

1. Right-click the extension icon
2. Click **Options**
3. Under **AI Provider**, select **"GitHub Copilot (Free Alternative)"**
4. Click **Save**

### Step 2: Authenticate with GitHub

1. In the Copilot settings section, click **"Authenticate with GitHub"**
2. A new browser tab will open to `https://github.com/login/device`
3. A popup will show you a **device code** (e.g., `ABCD-1234`)
4. Enter this code on the GitHub page
5. Click **Continue** and authorize the application
6. Grant the requested permissions (read:user scope)
7. Return to the extension options page
8. You should see **"✓ Authenticated"** status

### Step 3: Start Using

That's it! Now when you:
- Click **"Send to ChatGPT"** → Uses GitHub Copilot
- Click **"Generate Cover Letter"** → Uses GitHub Copilot

---

## 🔐 Authentication Details

### What Permissions Are Requested?

The extension requests minimal permissions:
- **Scope**: `read:user` - Only reads your basic GitHub profile information
- **No code access**: The extension does NOT access your repositories or code
- **No write permissions**: Cannot modify anything on your GitHub account

### How Authentication Works

The extension uses GitHub's **Device Flow OAuth**:

1. **Device Code Request**: Extension requests a device code from GitHub
2. **User Authorization**: You manually authorize on GitHub's website
3. **Access Token**: After authorization, extension receives an access token
4. **Copilot Token**: Access token is exchanged for a Copilot session token
5. **Secure Storage**: Tokens are stored locally in Chrome's secure storage

### Token Security

- ✅ Tokens stored in Chrome's encrypted storage
- ✅ Never transmitted to third parties
- ✅ Only used to communicate with GitHub's official APIs
- ✅ Can be revoked anytime from GitHub settings

---

## 🔄 Managing Authentication

### Check Authentication Status

In the extension options:
- **"✓ Authenticated"** (green) = Ready to use
- **"Not authenticated"** (gray) = Need to authenticate

### Logout / Revoke Access

**From Extension:**
1. Go to extension Options
2. Select "GitHub Copilot" as AI Provider
3. Click **"Logout"** button
4. Confirm the action

**From GitHub:**
1. Go to [GitHub Settings → Applications](https://github.com/settings/applications)
2. Find "GitHub Copilot" in authorized apps
3. Click **Revoke** to remove access

### Re-authenticate

If your token expires or you logout:
1. Click **"Authenticate with GitHub"** again
2. Follow the same authentication steps

---

## 🆚 OpenAI vs GitHub Copilot

| Feature | OpenAI | GitHub Copilot |
|---------|--------|----------------|
| **Cost** | Pay per API call | $10/month (or free with Education) |
| **Setup** | API key required | GitHub authentication |
| **Model** | Choose (GPT-4, GPT-3.5, etc.) | GPT-4o (fixed) |
| **Custom Endpoint** | ✅ Supported | ❌ Not applicable |
| **Rate Limits** | Based on your plan | Based on Copilot subscription |
| **Best For** | Custom models, high volume | Cost-effective, students |

---

## 🐛 Troubleshooting

### "Not authenticated" Error

**Solution:**
1. Make sure you have an active GitHub Copilot subscription
2. Try logging out and re-authenticating
3. Check if your Copilot subscription is active at [GitHub Settings](https://github.com/settings/copilot)

### "Failed to get Copilot token" Error

**Possible Causes:**
- Your GitHub Copilot subscription expired
- Access token is invalid or expired
- Network connectivity issues

**Solution:**
1. Verify your Copilot subscription is active
2. Logout and re-authenticate
3. Check your internet connection

### "Authorization pending" Timeout

**Solution:**
1. Make sure you entered the device code correctly
2. Complete the authorization within the time limit (usually 15 minutes)
3. If timeout occurs, click "Authenticate" again to get a new code

### Device Code Not Working

**Solution:**
1. Make sure you're entering the code at `https://github.com/login/device`
2. Code is case-sensitive - enter exactly as shown
3. Code expires after 15 minutes - get a new one if expired

### "No Copilot subscription" Error

**Solution:**
1. Verify you have an active Copilot subscription
2. Visit [GitHub Copilot](https://github.com/features/copilot) to subscribe
3. Or apply for free access through [GitHub Education](https://education.github.com/)

---

## 🔒 Privacy & Security

### What Data is Sent to GitHub?

When using GitHub Copilot:
- ✅ Job descriptions (for analysis)
- ✅ Your resume (for cover letter generation)
- ✅ Prompts and queries

### What Data is NOT Sent?

- ❌ Your browsing history
- ❌ LinkedIn credentials
- ❌ Personal data beyond what you explicitly send for analysis
- ❌ Extension settings or configuration

### Data Retention

- GitHub processes requests in real-time
- Refer to [GitHub's Privacy Policy](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement) for details
- Your data is subject to GitHub's data handling practices

---

## 📚 Technical Details

### API Endpoints Used

1. **Device Authorization**: `https://github.com/login/device/code`
2. **Token Exchange**: `https://github.com/login/oauth/access_token`
3. **Copilot Token**: `https://api.github.com/copilot_internal/v2/token`
4. **Chat Completions**: `https://api.githubcopilot.com/chat/completions`

### OAuth Client ID

- **Client ID**: `Iv1.b507a08c87ecfe98`
- This is the official GitHub Copilot client ID used by various editors

### Model Used

- **Model**: `gpt-4o`
- This is the default model provided by GitHub Copilot
- Cannot be changed (unlike OpenAI where you can choose models)

---

## 💡 Tips & Best Practices

### For Best Results

1. **Keep prompts clear**: The default prompts work well, but you can customize them
2. **Resume quality**: Upload a well-formatted PDF resume for better cover letters
3. **Token refresh**: If you get errors, try logging out and re-authenticating

### Cost Optimization

- **Students**: Use GitHub Education for free Copilot access
- **Developers**: If you already have Copilot for coding, use it here too!
- **Teams**: GitHub Copilot Business might be available through your organization

### Switching Between Providers

You can easily switch between OpenAI and Copilot:
1. Go to Options
2. Change **AI Provider** dropdown
3. Click **Save**
4. No need to restart the extension

---

## 🤝 Support

### Need Help?

- **GitHub Copilot Issues**: [GitHub Support](https://support.github.com/)
- **Extension Issues**: [Open an issue on GitHub](https://github.com/hadi2f244/linkedin-scraper-ext/issues)
- **Subscription Questions**: [GitHub Copilot FAQ](https://github.com/features/copilot#faq)

### Useful Links

- [GitHub Copilot Documentation](https://docs.github.com/en/copilot)
- [GitHub Education](https://education.github.com/)
- [GitHub Copilot Pricing](https://github.com/features/copilot#pricing)

---

## 📝 Notes

- GitHub Copilot integration uses the same API that powers Copilot in VS Code and other editors
- The extension does NOT require VS Code or any other editor to be installed
- Authentication is independent of any other Copilot installations you may have
- You can use both OpenAI and Copilot - just switch in settings as needed

---

**Happy job hunting with GitHub Copilot! 🚀**

