(async () => {
    const keyEl = document.getElementById('key');
    const promptEl = document.getElementById('prompt');
    const autoSendEl = document.getElementById('auto-send');
    const keywordsEl = document.getElementById('keywords');
    const statusEl = document.getElementById('status');

    const settings = await chrome.storage.local.get([
        'OPENAI_API_KEY',
        'USER_PROMPT',
        'AUTO_SEND_CHATGPT',
        'SEARCH_KEYWORDS'
    ]);

    if (settings.OPENAI_API_KEY) {
        keyEl.value = settings.OPENAI_API_KEY;
    }

    if (settings.USER_PROMPT) {
        promptEl.value = settings.USER_PROMPT;
    } else {
        try {
            const resp = await fetch(chrome.runtime.getURL('prompt.txt'));
            if (resp.ok) {
                promptEl.value = await resp.text();
            }
        } catch {}
    }

    // Auto-send checkbox (default: false)
    autoSendEl.checked = settings.AUTO_SEND_CHATGPT || false;

    // Keywords field
    if (settings.SEARCH_KEYWORDS) {
        keywordsEl.value = settings.SEARCH_KEYWORDS;
    }

    document.getElementById('save').onclick = async () => {
        await chrome.storage.local.set({
            OPENAI_API_KEY: keyEl.value.trim(),
            USER_PROMPT: promptEl.value,
            AUTO_SEND_CHATGPT: autoSendEl.checked,
            SEARCH_KEYWORDS: keywordsEl.value.trim()
        });
        statusEl.textContent = 'Saved.';
        setTimeout(() => statusEl.textContent = '', 1500);
    };
})();
