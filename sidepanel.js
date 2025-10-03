// Side panel script for LinkedIn Job Scraper Extension

(async () => {
    const $ = (s) => document.querySelector(s);
    const statusEl = $('#status');
    const contentEl = $('#content');
    const rawTextContainer = $('#raw-text-container');
    const rawTextPreview = $('#raw-text-preview');
    const rawTextFull = $('#raw-text-full');
    const readMoreBtn = $('#read-more-btn');
    const aiStatusEl = $('#ai-status');
    const aiOutputEl = $('#ai-output');
    const sendBtn = $('#send');
    const refreshBtn = $('#refresh');

    $('#open-options').onclick = () => chrome.runtime.openOptionsPage();

    // Handle Read More button
    readMoreBtn.onclick = () => {
        rawTextContainer.classList.toggle('expanded');
        rawTextContainer.classList.toggle('collapsed');

        if (rawTextContainer.classList.contains('expanded')) {
            readMoreBtn.textContent = 'Read less';
        } else {
            readMoreBtn.textContent = 'Read more';
        }
    };

    let currentJobText = '';

    const setError = (msg) => {
        statusEl.className = 'error';
        statusEl.textContent = msg;
        contentEl.innerHTML = '';
    };

    const setStatus = (msg, isError = false) => {
        statusEl.className = isError ? 'error' : '';
        statusEl.textContent = msg;
    };

    const normalizeText = (t) => {
        if (!t) {
            return '';
        }
        return t
            .replace(/\u00A0/g, ' ')         // non-breaking spaces -> normal spaces
            .replace(/\r/g, '')              // CR
            .replace(/[ \t]+\n/g, '\n')      // trailing spaces before newline
            .replace(/\n{3,}/g, '\n\n')      // more than 2 empty lines -> 1 empty line
            .replace(/[ \t]{2,}/g, ' ')      // multiple spaces
            .trim();
    };

    // Display job data in the side panel
    const displayJobData = (jobText) => {
        if (!jobText) {
            setStatus('No job data available. Click on a job in LinkedIn.', true);
            rawTextPreview.textContent = '';
            rawTextFull.textContent = '';
            rawTextContainer.style.display = 'none';
            contentEl.innerHTML = '';
            sendBtn.disabled = true;
            return;
        }

        currentJobText = normalizeText(jobText);
        setStatus('Job data loaded ✓');

        // Show raw text in expandable section
        rawTextContainer.style.display = 'block';
        rawTextContainer.classList.add('collapsed');
        rawTextContainer.classList.remove('expanded');
        rawTextPreview.textContent = currentJobText;
        rawTextFull.textContent = currentJobText;
        readMoreBtn.textContent = 'Read more';

        contentEl.innerHTML = `<div class="muted">Job details extracted. Sending to ChatGPT automatically...</div>`;
        sendBtn.disabled = false;

        // Automatically send to ChatGPT after data is loaded
        setTimeout(() => {
            sendToChatGPT();
        }, 500);
    };

    // Request job data from the active LinkedIn tab
    const requestJobDataFromTab = async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab || !tab.url) {
                setError('No active tab found.');
                return;
            }

            const url = new URL(tab.url);
            if (!url.hostname.includes('linkedin.com') || !url.pathname.startsWith('/jobs')) {
                setStatus('Please navigate to a LinkedIn job page.', true);
                return;
            }

            setStatus('Fetching job data...');

            // Send message to content script to get current job data
            chrome.tabs.sendMessage(tab.id, { type: 'REQUEST_JOB_DATA' }, (response) => {
                if (chrome.runtime.lastError) {
                    setError('Could not connect to LinkedIn page. Try refreshing the page.');
                    return;
                }

                if (response && response.success && response.data) {
                    displayJobData(response.data.text);
                } else {
                    setStatus('No job details found. Click on a job listing.', true);
                }
            });

        } catch (e) {
            console.error(e);
            setError('Error fetching job data: ' + e.message);
        }
    };

    // Listen for messages from content script (automatic updates)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'JOB_DATA_UPDATED' && message.data) {
            console.log('Received job data update from content script');
            displayJobData(message.data.text);
        }
    });

    // Function to send to ChatGPT
    const sendToChatGPT = async () => {
        if (!currentJobText) {
            aiStatusEl.textContent = 'No job data to send.';
            return;
        }

        aiOutputEl.textContent = '';
        aiStatusEl.textContent = 'Sending to ChatGPT...';

        // Retrieve settings
        const { OPENAI_API_KEY, USER_PROMPT } = await chrome.storage.local.get(['OPENAI_API_KEY', 'USER_PROMPT']);

        // If key/prompt not found — try to load prompt.txt as default
        let prompt = USER_PROMPT || '';
        if (!prompt) {
            try {
                const resp = await fetch(chrome.runtime.getURL('prompt.txt'));
                if (resp.ok) {
                    prompt = await resp.text();
                }
            } catch {}
        }

        if (!OPENAI_API_KEY) {
            aiStatusEl.textContent = 'No API key. Open options and enter the key.';
            return;
        }

        if (!prompt) {
            aiStatusEl.textContent = 'No prompt. Set a prompt in options or add prompt.txt.';
            return;
        }

        // Final prompt: append the job text at the end
        const fullPrompt = `${prompt.trim()}\n\n-----${currentJobText}`;

        try {
            const resp = await fetch('https://chats.qgpt.ir/api/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4.1',
                    messages: [
                        { role: 'system', content: 'You are a summarizing assistant. Answer concisely, in a structured manner, and to the point.' },
                        { role: 'user', content: fullPrompt }
                    ],
                    temperature: 0.2
                })
            });

            const data = await resp.json();
            if (!resp.ok) {
                throw new Error(data?.error?.message || `HTTP ${resp.status}`);
            }

            const msg = data?.choices?.[0]?.message?.content?.trim() || '(empty response)';
            aiStatusEl.textContent = 'Done ✓';
            aiOutputEl.innerHTML = msg.replace(/\n/g, '<br>');

        } catch (err) {
            console.error(err);
            aiStatusEl.textContent = 'Error while requesting ChatGPT: ' + err.message;
        }
    };

    // Refresh button handler
    refreshBtn.onclick = requestJobDataFromTab;

    // Send button handler (for manual sending)
    sendBtn.onclick = sendToChatGPT;

    // Initialize: request job data from current tab
    setStatus('Initializing...');
    setTimeout(requestJobDataFromTab, 500);

})();

