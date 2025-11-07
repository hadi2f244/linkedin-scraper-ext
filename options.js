(async () => {
    // Tab switching logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            // Remove active class from all tabs and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            btn.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
        });
    });

    const aiProviderEl = document.getElementById('ai-provider');
    const openaiSettingsEl = document.getElementById('openai-settings');
    const copilotSettingsEl = document.getElementById('copilot-settings');
    const keyEl = document.getElementById('key');
    const apiEndpointEl = document.getElementById('api-endpoint');
    const aiModelEl = document.getElementById('ai-model');
    const promptEl = document.getElementById('prompt');
    const autoSendEl = document.getElementById('auto-send');
    const keywordsEl = document.getElementById('keywords');
    const badKeywordsEl = document.getElementById('bad-keywords');
    const resumeFileEl = document.getElementById('resume-file');
    const resumeStatusEl = document.getElementById('resume-status');
    const enableBadgeScannerEl = document.getElementById('enable-badge-scanner');
    const enableVisaBadgeEl = document.getElementById('enable-visa-badge');
    const badgeKeywordsEl = document.getElementById('badge-keywords');
    const csvFileEl = document.getElementById('csv-file');
    const csvStatusEl = document.getElementById('csv-status');
    const statusEl = document.getElementById('status');
    const copilotAuthBtn = document.getElementById('copilot-auth-btn');
    const copilotLogoutBtn = document.getElementById('copilot-logout-btn');
    const copilotStatusText = document.getElementById('copilot-status-text');
    const coverLetterPromptEl = document.getElementById('cover-letter-prompt');
    const addQuestionBtn = document.getElementById('add-question-btn');
    const questionsTbody = document.getElementById('questions-tbody');

    // Initialize Copilot Auth
    const copilotAuth = new CopilotAuth();

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

    // Question table management
    let questions = [];

    const loadQuestionsTable = () => {
        questionsTbody.innerHTML = '';

        questions.forEach((q, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="text" value="${q.question.replace(/"/g, '&quot;')}" data-index="${index}" data-field="question" /></td>
                <td><textarea data-index="${index}" data-field="prompt">${q.prompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea></td>
                <td>
                    <button class="btn btn-danger btn-small delete-question-btn" data-index="${index}">🗑️ Delete</button>
                </td>
            `;
            questionsTbody.appendChild(row);
        });

        // Add event listeners for inputs
        questionsTbody.querySelectorAll('input, textarea').forEach(el => {
            el.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                questions[index][field] = e.target.value;
            });
        });

        // Add event listeners for delete buttons
        questionsTbody.querySelectorAll('.delete-question-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                questions.splice(index, 1);
                loadQuestionsTable();
            });
        });
    };

    const addQuestion = () => {
        questions.push({
            question: 'New Question',
            prompt: 'Enter your AI prompt here. Use {job_title}, {company_name}, {job_description}, and {resume} as variables.'
        });
        loadQuestionsTable();
    };

    addQuestionBtn.addEventListener('click', addQuestion);

    // IndexedDB helper functions
    const openDatabase = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('VisaSponsorDB', 2); // Updated to version 2

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;

                // Version 1: Original stores
                if (oldVersion < 1) {
                    if (!db.objectStoreNames.contains('companies')) {
                        db.createObjectStore('companies', { keyPath: 'id', autoIncrement: true });
                    }
                    if (!db.objectStoreNames.contains('metadata')) {
                        db.createObjectStore('metadata', { keyPath: 'key' });
                    }
                }

                // Version 2: Add job cache and tracking stores
                if (oldVersion < 2) {
                    // Job cache store: stores scan results for each job
                    if (!db.objectStoreNames.contains('jobCache')) {
                        const jobCacheStore = db.createObjectStore('jobCache', { keyPath: 'jobId' });
                        jobCacheStore.createIndex('timestamp', 'timestamp', { unique: false });
                    }

                    // Job tracking store: tracks viewed and applied jobs
                    if (!db.objectStoreNames.contains('jobTracking')) {
                        const jobTrackingStore = db.createObjectStore('jobTracking', { keyPath: 'jobId' });
                        jobTrackingStore.createIndex('viewedAt', 'viewedAt', { unique: false });
                        jobTrackingStore.createIndex('appliedAt', 'appliedAt', { unique: false });
                    }
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

    // Toggle AI provider settings visibility
    const toggleAIProviderSettings = () => {
        const provider = aiProviderEl.value;
        if (provider === 'openai') {
            openaiSettingsEl.style.display = 'block';
            copilotSettingsEl.style.display = 'none';
        } else if (provider === 'copilot') {
            openaiSettingsEl.style.display = 'none';
            copilotSettingsEl.style.display = 'block';
        }
    };

    // Update Copilot authentication status
    const updateCopilotStatus = async () => {
        try {
            const accessToken = await copilotAuth.loadAccessToken();
            if (accessToken) {
                const result = await chrome.storage.local.get(['COPILOT_TOKEN_DATE']);
                const tokenDate = result.COPILOT_TOKEN_DATE ? new Date(result.COPILOT_TOKEN_DATE).toLocaleDateString() : 'Unknown';
                copilotStatusText.textContent = `✓ Authenticated (since ${tokenDate})`;
                copilotStatusText.style.color = '#2e7d32';
                copilotAuthBtn.style.display = 'none';
                copilotLogoutBtn.style.display = 'inline-block';
            } else {
                copilotStatusText.textContent = 'Not authenticated';
                copilotStatusText.style.color = '#666';
                copilotAuthBtn.style.display = 'inline-block';
                copilotLogoutBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking Copilot status:', error);
            copilotStatusText.textContent = 'Error checking status';
            copilotStatusText.style.color = '#c62828';
        }
    };

    // Handle Copilot authentication
    copilotAuthBtn.onclick = async () => {
        try {
            copilotAuthBtn.disabled = true;
            copilotStatusText.textContent = 'Initiating authentication...';
            copilotStatusText.style.color = '#0073b1';

            // Initiate device flow
            const deviceFlow = await copilotAuth.initiateDeviceFlow();

            // Open GitHub device authorization page
            window.open(deviceFlow.verificationUri, '_blank');

            // Show user code in a popup
            const userCodeMessage = `Please enter this code on GitHub:\n\n${deviceFlow.userCode}\n\nThe page should open automatically. If not, visit:\n${deviceFlow.verificationUri}`;
            alert(userCodeMessage);

            copilotStatusText.textContent = `Waiting for authorization... (Code: ${deviceFlow.userCode})`;

            // Poll for access token
            const accessToken = await copilotAuth.pollForAccessToken(deviceFlow.deviceCode, deviceFlow.interval);

            // Save access token
            await copilotAuth.saveAccessToken(accessToken);

            // Verify Copilot access by trying to get a Copilot token
            copilotStatusText.textContent = 'Verifying Copilot access...';
            try {
                await copilotAuth.getCopilotToken(accessToken);
                copilotStatusText.textContent = '✓ Authentication successful! Copilot access verified.';
                copilotStatusText.style.color = '#2e7d32';
            } catch (verifyError) {
                // Authentication succeeded but Copilot access failed
                copilotStatusText.innerHTML = `⚠️ Authenticated but Copilot not available.<br><small>${verifyError.message}</small>`;
                copilotStatusText.style.color = '#f57c00'; // Orange warning color

                // Clear the saved token since it won't work
                await copilotAuth.clearAuth();
                copilotAuthBtn.disabled = false;
                return;
            }

            // Update UI
            await updateCopilotStatus();

        } catch (error) {
            console.error('Copilot authentication error:', error);
            copilotStatusText.textContent = `Error: ${error.message}`;
            copilotStatusText.style.color = '#c62828';
            copilotAuthBtn.disabled = false;
        }
    };

    // Handle Copilot logout
    copilotLogoutBtn.onclick = async () => {
        if (confirm('Are you sure you want to logout from GitHub Copilot?')) {
            await copilotAuth.clearAuth();
            await updateCopilotStatus();
        }
    };

    // AI provider change handler
    aiProviderEl.addEventListener('change', toggleAIProviderSettings);

    // Load settings
    const settings = await chrome.storage.local.get([
        'AI_PROVIDER',
        'OPENAI_API_KEY',
        'API_ENDPOINT',
        'AI_MODEL',
        'USER_PROMPT',
        'AUTO_SEND_CHATGPT',
        'SEARCH_KEYWORDS',
        'BAD_KEYWORDS',
        'RESUME_TEXT',
        'RESUME_FILENAME',
        'RESUME_UPLOAD_DATE',
        'ENABLE_BADGE_SCANNER',
        'ENABLE_VISA_BADGE',
        'BADGE_KEYWORDS',
        'COVER_LETTER_PROMPT',
        'APPLICATION_QUESTIONS'
    ]);

    // Set AI provider
    if (settings.AI_PROVIDER) {
        aiProviderEl.value = settings.AI_PROVIDER;
    } else {
        aiProviderEl.value = 'openai'; // Default to OpenAI
    }
    toggleAIProviderSettings();

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

    // Badge scanner settings
    enableBadgeScannerEl.checked = settings.ENABLE_BADGE_SCANNER || false;
    enableVisaBadgeEl.checked = settings.ENABLE_VISA_BADGE !== false; // Default to true

    if (settings.BADGE_KEYWORDS) {
        badgeKeywordsEl.value = settings.BADGE_KEYWORDS;
    } else {
        // Set default badge keywords - all GREEN for easy visibility
        badgeKeywordsEl.value = 'kubernetes|#4caf50\ndocker|#4caf50\npython|#4caf50\naws|#4caf50';
    }

    // Cover letter prompt
    if (settings.COVER_LETTER_PROMPT) {
        coverLetterPromptEl.value = settings.COVER_LETTER_PROMPT;
    } else {
        // Set default cover letter prompt with variables
        coverLetterPromptEl.value = `You are a professional career advisor. Based on the following resume and job description, write a compelling, professional cover letter.

RESUME:
{resume}

JOB TITLE: {job_title}
COMPANY: {company_name}

JOB DESCRIPTION:
{job_description}

Please write a cover letter that:
1. Is professional and well-structured
2. Highlights relevant experience from the resume that matches the job requirements
3. Shows genuine enthusiasm for the position
4. Is concise (around 300-400 words)
5. Follows standard cover letter format (greeting, body paragraphs, closing)
6. Uses a confident but not arrogant tone
7. Addresses specific requirements mentioned in the job description

Write only the cover letter text, without any additional commentary or explanations.`;
    }

    // Application questions - load into table
    if (settings.APPLICATION_QUESTIONS) {
        const questionLines = settings.APPLICATION_QUESTIONS.split('\n').filter(line => line.trim() && line.includes('|'));
        questions = questionLines.map(line => {
            const [question, prompt] = line.split('|').map(s => s.trim());
            return { question, prompt };
        });
    } else {
        // Set default application questions with good prompts
        questions = [
            { question: 'Why do you want to work here?', prompt: 'Based on the job description for {job_title} at {company_name} and my resume, explain why I\'m genuinely interested in this role and company. Be specific about what excites me about the company\'s mission, products, or culture. Keep it concise (2-3 sentences).' },
            { question: 'What are your salary expectations?', prompt: 'Based on the job title "{job_title}" and my experience level shown in my resume, suggest a reasonable salary range for this position in the UK market. Be professional and data-driven.' },
            { question: 'What are your strengths?', prompt: 'Based on my resume and the requirements in the job description for {job_title}, identify my top 3-4 strengths that are most relevant to this role. Provide specific examples from my experience.' },
            { question: 'What are your weaknesses?', prompt: 'Provide 1-2 honest but professional weaknesses that won\'t disqualify me for {job_title}. Frame them as areas I\'m actively working to improve, with specific steps I\'m taking.' },
            { question: 'Why should we hire you?', prompt: 'Based on my resume and the job description for {job_title} at {company_name}, create a compelling 2-3 sentence pitch explaining why I\'m the ideal candidate. Focus on unique value I bring.' },
            { question: 'Where do you see yourself in 5 years?', prompt: 'Based on the career path for {job_title} and my background, describe realistic career goals that align with this role and show ambition without seeming like I\'ll leave quickly.' },
            { question: 'Do you have experience with [specific technology]?', prompt: 'Based on my resume, honestly state whether I have experience with the specific technology mentioned in the job description. If yes, provide brief details. If no, mention related experience or willingness to learn.' },
            { question: 'Are you authorized to work in the UK?', prompt: 'Answer honestly based on my situation. If I need visa sponsorship, mention it professionally and express willingness to work through the process.' },
            { question: 'What is your notice period?', prompt: 'Provide a professional answer about my current notice period. If unemployed, state I\'m available immediately. If employed, mention standard notice period (typically 2-4 weeks or as per contract).' },
            { question: 'Tell me about a challenging project you worked on.', prompt: 'Based on my resume, describe a challenging technical project I worked on, the obstacles I faced, how I overcame them, and the results. Keep it relevant to {job_title}.' }
        ];
    }

    loadQuestionsTable();

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
            AI_PROVIDER: aiProviderEl.value,
            OPENAI_API_KEY: keyEl.value.trim(),
            API_ENDPOINT: apiEndpointEl.value.trim(),
            AI_MODEL: aiModelEl.value.trim() || 'gpt-4o-mini',
            USER_PROMPT: promptEl.value,
            AUTO_SEND_CHATGPT: autoSendEl.checked,
            SEARCH_KEYWORDS: keywordsEl.value.trim(),
            BAD_KEYWORDS: badKeywordsEl.value.trim(),
            ENABLE_BADGE_SCANNER: enableBadgeScannerEl.checked,
            ENABLE_VISA_BADGE: enableVisaBadgeEl.checked,
            BADGE_KEYWORDS: badgeKeywordsEl.value.trim(),
            COVER_LETTER_PROMPT: coverLetterPromptEl.value.trim(),
            APPLICATION_QUESTIONS: questions.map(q => `${q.question} | ${q.prompt}`).join('\n')
        };

        console.log('Saving settings:', {
            ...settingsToSave,
            OPENAI_API_KEY: settingsToSave.OPENAI_API_KEY ? 'Present' : 'Empty'
        });

        await chrome.storage.local.set(settingsToSave);
        statusEl.textContent = 'Saved.';
        setTimeout(() => statusEl.textContent = '', 1500);
    };

    // Initialize Copilot status on load
    await updateCopilotStatus();
})();
