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
    const companyNameInput = $('#company-name-input');
    const checkVisaBtn = $('#check-visa-btn');

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
    let currentCompanyName = '';
    let abortController = null; // For canceling fetch requests
    let isSending = false;

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

    // Normalize company name for comparison
    const normalizeCompanyName = (name) => {
        if (!name) return '';
        return name
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s&]/g, '')
            .trim();
    };

    // Extract core company name (remove common suffixes)
    const extractCoreCompanyName = (name) => {
        if (!name) return '';

        let core = normalizeCompanyName(name);

        // Remove common company suffixes
        const suffixes = [
            'limited', 'ltd', 'plc', 'llc', 'inc', 'incorporated',
            'corporation', 'corp', 'company', 'co', 'group', 'holdings',
            'international', 'intl', 'uk', 'usa', 'us', 'europe', 'global'
        ];

        // Remove suffixes from the end
        for (const suffix of suffixes) {
            const regex = new RegExp(`\\s+${suffix}$`, 'gi');
            core = core.replace(regex, '').trim();
        }

        return core;
    };

    // Check if two company names match (strict matching)
    const companyNamesMatch = (searchName, csvName) => {
        const n1 = normalizeCompanyName(searchName);
        const n2 = normalizeCompanyName(csvName);

        if (!n1 || !n2) return false;

        // Exact match after normalization
        if (n1 === n2) return true;

        // Extract core names (without suffixes)
        const core1 = extractCoreCompanyName(searchName);
        const core2 = extractCoreCompanyName(csvName);

        // Core names must match exactly
        if (core1 === core2 && core1.length > 0) return true;

        // For very short names (like "Teya"), require exact match of the core
        if (core1.length <= 5 || core2.length <= 5) {
            // Only match if one core is exactly the other (not just contains)
            return core1 === core2;
        }

        // For longer names, check if the search name is contained in CSV name
        // But only if it's at the start (to avoid false matches)
        if (core1.length > 5 && n2.startsWith(core1)) {
            return true;
        }

        if (core2.length > 5 && n1.startsWith(core2)) {
            return true;
        }

        return false;
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

    const searchCompaniesInIndexedDB = async (companyName) => {
        try {
            const db = await openDatabase();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['companies'], 'readonly');
                const store = transaction.objectStore('companies');
                const request = store.getAll();

                request.onsuccess = () => {
                    const allCompanies = request.result;
                    const matches = [];

                    const searchCore = extractCoreCompanyName(companyName);

                    for (const row of allCompanies) {
                        const orgName = row['Organisation Name'] || '';
                        if (companyNamesMatch(companyName, orgName)) {
                            // Calculate match score for sorting
                            const csvCore = extractCoreCompanyName(orgName);
                            let score = 0;

                            // Exact match gets highest score
                            if (normalizeCompanyName(companyName) === normalizeCompanyName(orgName)) {
                                score = 100;
                            }
                            // Core exact match
                            else if (searchCore === csvCore) {
                                score = 90;
                            }
                            // Starts with search term
                            else if (normalizeCompanyName(orgName).startsWith(normalizeCompanyName(companyName))) {
                                score = 80;
                            }
                            // Contains search term
                            else {
                                score = 50;
                            }

                            matches.push({ ...row, matchScore: score });
                        }
                    }

                    // Sort by match score (highest first) and limit to top 5
                    matches.sort((a, b) => b.matchScore - a.matchScore);
                    const topMatches = matches.slice(0, 5);

                    db.close();
                    resolve(topMatches);
                };

                request.onerror = () => {
                    db.close();
                    reject(request.error);
                };
            });
        } catch (err) {
            console.error('IndexedDB error:', err);
            return [];
        }
    };

    const checkIfDatabaseExists = async () => {
        try {
            const db = await openDatabase();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['metadata'], 'readonly');
                const store = transaction.objectStore('metadata');
                const request = store.get('count');

                request.onsuccess = () => {
                    db.close();
                    resolve(request.result?.value > 0);
                };

                request.onerror = () => {
                    db.close();
                    resolve(false);
                };
            });
        } catch (err) {
            return false;
        }
    };

    // Check visa sponsorship status
    const checkVisaSponsorship = async (companyName) => {
        if (!companyName || companyName.trim() === '') {
            console.log('No company name provided for visa check');
            return `<div class="visa-results visa-no-data">
                <h3>🔍 Visa Sponsorship Check</h3>
                <p class="warning">⚠️ Could not extract company name from LinkedIn page. The company name is needed to check visa sponsorship status.</p>
            </div>`;
        }

        console.log('Checking visa sponsorship for company:', companyName);

        // Check if database has data
        const hasData = await checkIfDatabaseExists();

        if (!hasData) {
            return `<div class="visa-results visa-no-data">
                <h3>🔍 Visa Sponsorship Check</h3>
                <p class="company-name">Company: <strong>${companyName}</strong></p>
                <p class="warning">⚠️ No CSV data loaded. Please upload the UK visa sponsorship CSV file in the options page.</p>
            </div>`;
        }

        // Search for company in IndexedDB
        const matches = await searchCompaniesInIndexedDB(companyName);

        if (matches.length === 0) {
            return `<div class="visa-results visa-not-found">
                <h3>🔍 Visa Sponsorship Check</h3>
                <p class="company-name">Company: <strong>${companyName}</strong></p>
                <p class="status-not-found">❌ <strong>Not found</strong> in UK visa sponsorship register</p>
                <p class="muted">This company does not appear to have a UK visa sponsorship license.</p>
            </div>`;
        }

        // Found matches - display top results
        const matchText = matches.length === 1 ? '1 match' : `${matches.length} matches`;
        let html = `<div class="visa-results visa-found">
            <h3>🔍 Visa Sponsorship Check</h3>
            <p class="company-name">Searched: <strong>${companyName}</strong></p>
            <p class="status-found">✅ <strong>Found ${matchText} in UK visa sponsorship register!</strong></p>`;

        if (matches.length > 1) {
            html += `<p class="muted" style="font-size: 12px; margin: 4px 0;">Showing top ${matches.length} matches sorted by relevance</p>`;
        }

        html += `<div class="visa-details">`;

        matches.forEach((match, index) => {
            // Show match quality indicator
            let matchQuality = '';
            if (match.matchScore >= 90) {
                matchQuality = '<span class="match-quality exact">Exact Match</span>';
            } else if (match.matchScore >= 80) {
                matchQuality = '<span class="match-quality high">High Match</span>';
            } else {
                matchQuality = '<span class="match-quality medium">Possible Match</span>';
            }

            html += `
                <div class="visa-record">
                    ${matchQuality}
                    <div class="visa-field"><span class="label">Organisation:</span> <strong>${match['Organisation Name'] || 'N/A'}</strong></div>
                    <div class="visa-field"><span class="label">Town/City:</span> ${match['Town/City'] || 'N/A'}</div>
                    <div class="visa-field"><span class="label">County:</span> ${match['County'] || 'N/A'}</div>
                    <div class="visa-field"><span class="label">Type & Rating:</span> <span class="badge">${match['Type & Rating'] || 'N/A'}</span></div>
                    <div class="visa-field"><span class="label">Route:</span> <span class="badge route">${match['Route'] || 'N/A'}</span></div>
                </div>
            `;
            if (index < matches.length - 1) {
                html += '<hr class="visa-divider">';
            }
        });

        html += `</div></div>`;
        return html;
    };

    // Check keywords in job text
    const checkKeywords = (jobText, keywords) => {
        if (!keywords || !keywords.trim()) {
            return '';
        }

        const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k);
        if (keywordList.length === 0) {
            return '';
        }

        const lowerJobText = jobText.toLowerCase();
        let html = '<div class="keyword-results"><h3>Keyword Search Results:</h3><ul>';

        keywordList.forEach(keyword => {
            const found = lowerJobText.includes(keyword.toLowerCase());
            const icon = found ? '✅' : '❌';
            const className = found ? 'keyword-found' : 'keyword-not-found';
            html += `<li class="${className}">${icon} <strong>${keyword}</strong></li>`;
        });

        html += '</ul></div>';
        return html;
    };

    // Display job data in the side panel
    const displayJobData = async (jobData) => {
        // Handle both old format (string) and new format (object)
        let jobText, companyName;
        if (typeof jobData === 'string') {
            jobText = jobData;
            companyName = '';
        } else if (jobData && typeof jobData === 'object') {
            jobText = jobData.text;
            companyName = jobData.companyName || '';
        } else {
            setStatus('No job data available. Click on a job in LinkedIn.', true);
            rawTextPreview.textContent = '';
            rawTextFull.textContent = '';
            rawTextContainer.style.display = 'none';
            contentEl.innerHTML = '';
            sendBtn.disabled = true;
            return;
        }

        currentJobText = normalizeText(jobText);
        currentCompanyName = companyName;

        // Update company name input field
        if (companyName) {
            companyNameInput.value = companyName;
        }

        setStatus('Job data loaded ✓');

        // Show raw text in expandable section
        rawTextContainer.style.display = 'block';
        rawTextContainer.classList.add('collapsed');
        rawTextContainer.classList.remove('expanded');
        rawTextPreview.textContent = currentJobText;
        rawTextFull.textContent = currentJobText;
        readMoreBtn.textContent = 'Read more';

        sendBtn.disabled = false;

        // Check if auto-send is enabled and get keywords
        const { AUTO_SEND_CHATGPT, SEARCH_KEYWORDS } = await chrome.storage.local.get(['AUTO_SEND_CHATGPT', 'SEARCH_KEYWORDS']);

        // Check visa sponsorship
        const visaHtml = await checkVisaSponsorship(companyName);

        // Display keyword search results
        const keywordHtml = checkKeywords(currentJobText, SEARCH_KEYWORDS);

        if (AUTO_SEND_CHATGPT) {
            contentEl.innerHTML = visaHtml + keywordHtml + `<div class="muted" style="margin-top: 12px;">Job details extracted. Sending to ChatGPT automatically...</div>`;
            // Automatically send to ChatGPT after data is loaded
            setTimeout(() => {
                sendToChatGPT();
            }, 500);
        } else {
            contentEl.innerHTML = visaHtml + keywordHtml + `<div class="muted" style="margin-top: 12px;">Job details extracted. Click "Send to ChatGPT" to get a summary.</div>`;
        }
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
                    console.log('Received job data from manual refresh:', response.data);
                    console.log('Company name from manual refresh:', response.data.companyName);
                    // Pass the entire data object, not just the text
                    displayJobData(response.data);
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
            console.log('Message data:', message.data);
            console.log('Company name in message:', message.data.companyName);
            // Pass the entire data object, not just the text
            displayJobData(message.data);
        }
    });

    // Function to send to ChatGPT
    const sendToChatGPT = async () => {
        if (!currentJobText) {
            aiStatusEl.textContent = 'No job data to send.';
            return;
        }

        // Change button to "Stop ChatGPT"
        isSending = true;
        sendBtn.textContent = 'Stop ChatGPT';
        sendBtn.style.background = '#d32f2f';

        aiOutputEl.textContent = '';
        aiStatusEl.textContent = 'Sending to ChatGPT...';

        // Create new abort controller
        abortController = new AbortController();

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
            resetSendButton();
            return;
        }

        if (!prompt) {
            aiStatusEl.textContent = 'No prompt. Set a prompt in options or add prompt.txt.';
            resetSendButton();
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
                }),
                signal: abortController.signal
            });

            const data = await resp.json();
            if (!resp.ok) {
                throw new Error(data?.error?.message || `HTTP ${resp.status}`);
            }

            const msg = data?.choices?.[0]?.message?.content?.trim() || '(empty response)';
            aiStatusEl.textContent = 'Done ✓';
            aiOutputEl.innerHTML = msg.replace(/\n/g, '<br>');

            // Reset button after successful response
            resetSendButton();

        } catch (err) {
            console.error(err);
            if (err.name === 'AbortError') {
                aiStatusEl.textContent = 'Request cancelled.';
            } else {
                aiStatusEl.textContent = 'Error while requesting ChatGPT: ' + err.message;
            }
            resetSendButton();
        }
    };

    // Reset send button to original state
    const resetSendButton = () => {
        isSending = false;
        sendBtn.textContent = 'Send to ChatGPT';
        sendBtn.style.background = '';
        abortController = null;
    };

    // Refresh button handler
    refreshBtn.onclick = requestJobDataFromTab;

    // Send button handler (for manual sending or stopping)
    sendBtn.onclick = () => {
        if (isSending && abortController) {
            // Stop the request
            abortController.abort();
            resetSendButton();
        } else {
            // Send to ChatGPT
            sendToChatGPT();
        }
    };

    // Manual visa check button handler
    checkVisaBtn.onclick = async () => {
        const manualCompanyName = companyNameInput.value.trim();
        if (!manualCompanyName) {
            alert('Please enter a company name');
            return;
        }

        currentCompanyName = manualCompanyName;

        // Re-run the visa check with the manual company name
        const { SEARCH_KEYWORDS } = await chrome.storage.local.get(['SEARCH_KEYWORDS']);
        const visaHtml = await checkVisaSponsorship(manualCompanyName);
        const keywordHtml = checkKeywords(currentJobText, SEARCH_KEYWORDS);

        contentEl.innerHTML = visaHtml + keywordHtml + `<div class="muted" style="margin-top: 12px;">Job details extracted. Click "Send to ChatGPT" to get a summary.</div>`;
    };

    // Initialize: request job data from current tab
    setStatus('Initializing...');
    setTimeout(requestJobDataFromTab, 500);

})();

