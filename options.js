(async () => {
    const keyEl = document.getElementById('key');
    const promptEl = document.getElementById('prompt');
    const statusEl = document.getElementById('status');

    const { OPENAI_API_KEY, USER_PROMPT } = await chrome.storage.local.get(['OPENAI_API_KEY', 'USER_PROMPT']);

    if (OPENAI_API_KEY) {
        keyEl.value = OPENAI_API_KEY;
    }

    if (USER_PROMPT) {
        promptEl.value = USER_PROMPT;
    } else {
        try {
            const resp = await fetch(chrome.runtime.getURL('prompt.txt'));
            if (resp.ok) {
                promptEl.value = await resp.text();
            }
        } catch {}
    }

    document.getElementById('save').onclick = async () => {
        await chrome.storage.local.set({
            OPENAI_API_KEY: keyEl.value.trim(),
            USER_PROMPT: promptEl.value
        });
        statusEl.textContent = 'Saved.';
        setTimeout(() => statusEl.textContent = '', 1500);
    };
})();
