(async () => {
    const $ = (s) => document.querySelector(s);
    const statusEl = $('#status');
    const contentEl = $('#content');
    const rawEl = $('#raw');
    const aiStatusEl = $('#ai-status');
    const aiOutputEl = $('#ai-output');
    $('#open-options').onclick = () => chrome.runtime.openOptionsPage();

    const setError = (msg) => {
        statusEl.className = 'error';
        statusEl.textContent = msg;
        contentEl.innerHTML = '';
    };

    normalizeText = (t) => {
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
    }

    // active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
        return setError('Failed to get the active tab.');
    }

    let hostname;
    try {
        hostname = new URL(tab.url).hostname.replace(/^www\./, '');
    }
    catch {
        return setError('Invalid tab URL.');
    }

    if (hostname !== 'linkedin.com') {
        document.write('This is not linkedin.com');
    }

    statusEl.textContent = 'Looking for #job-details > div...';

    // extract TEXT directly from the page (innerText), so we don't have to clean HTML in the popup
    let text = '';
    try {
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: () => {
                waitForSelector = (sel, timeout = 5000) => {
                    return new Promise((resolve, reject) => {
                        const now = document.querySelector(sel);
                        if (now) {
                            return resolve(now);
                        }
                        const obs = new MutationObserver(() => {
                            const el = document.querySelector(sel);
                            if (el) {
                                obs.disconnect(); resolve(el);
                            }
                        });
                        obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
                        setTimeout(() => {
                            obs.disconnect();
                            document.querySelector(sel)
                                ? resolve(document.querySelector(sel))
                                : reject(new Error('not-found'));
                            }, timeout);
                    });
                }
                return waitForSelector('#job-details > div').then(el => ({
                    ok: true,
                    text: el.innerText || el.textContent || ''
                })).catch(() => ({ ok: false }));
            }
        });

        if (!result?.ok) {
            statusEl.className = 'error';
            statusEl.textContent = 'Did not find #job-details > div';
            contentEl.innerHTML = '<div class="muted">Open the job page or scroll — LinkedIn will load the block.</div>';
            return;
        }

        text = result.text;

    } catch (e) {
        console.error(e);
        return setError('Error executing script in the page.');
    }

    // clean and display
    const cleaned = normalizeText(text);
    statusEl.textContent = 'Done';
    rawEl.textContent = cleaned;
    contentEl.innerHTML = `<div class="muted">Text cleaned. You can now send it to ChatGPT.</div>`;

    // handler for sending to OpenAI
    $('#send').onclick = async () => {
        aiOutputEl.textContent = '';
        aiStatusEl.textContent = 'Sending to ChatGPT...';

        // retrieve settings
        const { OPENAI_API_KEY, USER_PROMPT } = await chrome.storage.local.get(['OPENAI_API_KEY', 'USER_PROMPT']);

        // if key/prompt not found — try to load prompt.txt as default
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

        // final prompt: append the job text at the end
        const fullPrompt = `${prompt.trim()}\n\n-----${cleaned}`;

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
            aiStatusEl.textContent = 'Done';
            aiOutputEl.innerHTML = msg.replace(/\n/g, '<br>');

        } catch (err) {
            console.error(err);
            aiStatusEl.textContent = 'Error while requesting ChatGPT: ' + err.message;
        }
    };
})();