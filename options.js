(async () => {
    const keyEl = document.getElementById('key');
    const apiEndpointEl = document.getElementById('api-endpoint');
    const aiModelEl = document.getElementById('ai-model');
    const promptEl = document.getElementById('prompt');
    const autoSendEl = document.getElementById('auto-send');
    const keywordsEl = document.getElementById('keywords');
    const badKeywordsEl = document.getElementById('bad-keywords');
    const resumeFileEl = document.getElementById('resume-file');
    const resumeStatusEl = document.getElementById('resume-status');
    const csvFileEl = document.getElementById('csv-file');
    const csvStatusEl = document.getElementById('csv-status');
    const statusEl = document.getElementById('status');

    // Configure PDF.js worker - use local file
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
    }

    // PDF parsing function
    const parsePDF = async (file) => {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js library not loaded');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';

        // Extract text from all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }

        return fullText.trim();
    };

    // IndexedDB helper functions
    const openDatabase = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('VisaSponsorDB', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('companies')) {
                    db.createObjectStore('companies', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };
        });
    };

    const saveToIndexedDB = async (data, filename) => {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['companies', 'metadata'], 'readwrite');
            const companiesStore = transaction.objectStore('companies');
            const metadataStore = transaction.objectStore('metadata');

            // Clear existing data
            companiesStore.clear();

            // Add all companies
            data.forEach(company => {
                companiesStore.add(company);
            });

            // Save metadata
            metadataStore.put({ key: 'filename', value: filename });
            metadataStore.put({ key: 'count', value: data.length });
            metadataStore.put({ key: 'uploadDate', value: new Date().toISOString() });

            transaction.oncomplete = () => {
                db.close();
                resolve();
            };

            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };
        });
    };

    const getMetadataFromIndexedDB = async () => {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['metadata'], 'readonly');
            const store = transaction.objectStore('metadata');

            const filenameRequest = store.get('filename');
            const countRequest = store.get('count');

            transaction.oncomplete = () => {
                db.close();
                resolve({
                    filename: filenameRequest.result?.value,
                    count: countRequest.result?.value
                });
            };

            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };
        });
    };

    // Load settings
    const settings = await chrome.storage.local.get([
        'OPENAI_API_KEY',
        'API_ENDPOINT',
        'AI_MODEL',
        'USER_PROMPT',
        'AUTO_SEND_CHATGPT',
        'SEARCH_KEYWORDS',
        'BAD_KEYWORDS',
        'RESUME_TEXT',
        'RESUME_FILENAME',
        'RESUME_UPLOAD_DATE'
    ]);

    if (settings.OPENAI_API_KEY) {
        keyEl.value = settings.OPENAI_API_KEY;
    }

    if (settings.API_ENDPOINT) {
        apiEndpointEl.value = settings.API_ENDPOINT;
    }

    if (settings.AI_MODEL) {
        aiModelEl.value = settings.AI_MODEL;
    } else {
        // Set default model
        aiModelEl.value = 'gpt-4o-mini';
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

    // Bad keywords field
    if (settings.BAD_KEYWORDS) {
        badKeywordsEl.value = settings.BAD_KEYWORDS;
    }

    // Display resume status
    if (settings.RESUME_TEXT && settings.RESUME_FILENAME) {
        const uploadDate = settings.RESUME_UPLOAD_DATE ? new Date(settings.RESUME_UPLOAD_DATE).toLocaleDateString() : 'Unknown';
        const textLength = settings.RESUME_TEXT.length;
        resumeStatusEl.textContent = `✓ Loaded: ${settings.RESUME_FILENAME} (${textLength} characters, uploaded ${uploadDate})`;
        resumeStatusEl.style.color = '#2e7d32';
    } else {
        resumeStatusEl.textContent = 'No resume uploaded yet.';
        resumeStatusEl.style.color = '#666';
    }

    // Handle resume file upload
    resumeFileEl.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            resumeStatusEl.textContent = 'Error: Please upload a PDF file';
            resumeStatusEl.style.color = '#c62828';
            return;
        }

        resumeStatusEl.textContent = 'Reading PDF file...';
        resumeStatusEl.style.color = '#0073b1';

        try {
            const resumeText = await parsePDF(file);

            if (!resumeText || resumeText.length < 50) {
                throw new Error('Could not extract text from PDF or text is too short');
            }

            resumeStatusEl.textContent = 'Saving resume...';

            // Store resume in chrome.storage
            await chrome.storage.local.set({
                RESUME_TEXT: resumeText,
                RESUME_FILENAME: file.name,
                RESUME_UPLOAD_DATE: new Date().toISOString()
            });

            const uploadDate = new Date().toLocaleDateString();
            resumeStatusEl.textContent = `✓ Loaded: ${file.name} (${resumeText.length} characters, uploaded ${uploadDate})`;
            resumeStatusEl.style.color = '#2e7d32';

        } catch (err) {
            console.error('Resume upload error:', err);
            resumeStatusEl.textContent = `Error: ${err.message}`;
            resumeStatusEl.style.color = '#c62828';
        }
    });

    // Display CSV file status from IndexedDB
    try {
        const metadata = await getMetadataFromIndexedDB();
        if (metadata.filename && metadata.count) {
            csvStatusEl.textContent = `✓ Loaded: ${metadata.filename} (${metadata.count} companies)`;
            csvStatusEl.style.color = '#2e7d32';
        } else {
            csvStatusEl.textContent = 'No CSV file uploaded yet.';
            csvStatusEl.style.color = '#666';
        }
    } catch (err) {
        csvStatusEl.textContent = 'No CSV file uploaded yet.';
        csvStatusEl.style.color = '#666';
    }

    // Handle CSV file upload
    csvFileEl.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        csvStatusEl.textContent = 'Reading CSV file...';
        csvStatusEl.style.color = '#0073b1';

        try {
            const text = await file.text();

            csvStatusEl.textContent = 'Parsing CSV data...';

            // Parse CSV into array of objects
            const lines = text.split('\n');
            const headers = parseCSVLine(lines[0]);
            const data = [];

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const values = parseCSVLine(lines[i]);
                if (values.length === headers.length) {
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index];
                    });
                    data.push(row);
                }
            }

            csvStatusEl.textContent = 'Saving to database...';

            // Store in IndexedDB instead of chrome.storage
            await saveToIndexedDB(data, file.name);

            csvStatusEl.textContent = `✓ Loaded: ${file.name} (${data.length} companies)`;
            csvStatusEl.style.color = '#2e7d32';

        } catch (err) {
            console.error(err);
            csvStatusEl.textContent = `Error reading file: ${err.message}`;
            csvStatusEl.style.color = '#c62828';
        }
    });

    // Simple CSV line parser that handles quoted fields
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // End of field
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        // Add last field
        result.push(current.trim());
        return result;
    }

    document.getElementById('save').onclick = async () => {
        const settingsToSave = {
            OPENAI_API_KEY: keyEl.value.trim(),
            API_ENDPOINT: apiEndpointEl.value.trim(),
            AI_MODEL: aiModelEl.value.trim() || 'gpt-4o-mini',
            USER_PROMPT: promptEl.value,
            AUTO_SEND_CHATGPT: autoSendEl.checked,
            SEARCH_KEYWORDS: keywordsEl.value.trim(),
            BAD_KEYWORDS: badKeywordsEl.value.trim()
        };

        console.log('Saving settings:', {
            ...settingsToSave,
            OPENAI_API_KEY: settingsToSave.OPENAI_API_KEY ? 'Present' : 'Empty'
        });

        await chrome.storage.local.set(settingsToSave);
        statusEl.textContent = 'Saved.';
        setTimeout(() => statusEl.textContent = '', 1500);
    };
})();
