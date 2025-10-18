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
    const generateCoverLetterBtn = $('#generate-cover-letter');
    const refreshBtn = $('#refresh');
    const coverLetterContainer = $('#cover-letter-container');
    const toggleCoverLetterBtn = $('#toggle-cover-letter');
    const coverLetterContent = $('#cover-letter-content');
    const coverLetterStatus = $('#cover-letter-status');
    const coverLetterText = $('#cover-letter-text');
    const copyCoverLetterBtn = $('#copy-cover-letter');

    const openOptionsLink = $('#open-options');
    if (openOptionsLink) {
        openOptionsLink.onclick = () => chrome.runtime.openOptionsPage();
    }

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

    // Handle toggle cover letter button
    toggleCoverLetterBtn.onclick = () => {
        const isHidden = coverLetterContent.style.display === 'none';
        if (isHidden) {
            coverLetterContent.style.display = 'block';
            toggleCoverLetterBtn.textContent = 'Hide';
        } else {
            coverLetterContent.style.display = 'none';
            toggleCoverLetterBtn.textContent = 'Show';
        }
    };

    // Handle copy cover letter button
    copyCoverLetterBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(coverLetterText.textContent);
            const originalText = copyCoverLetterBtn.textContent;
            copyCoverLetterBtn.textContent = '✓ Copied!';
            setTimeout(() => {
                copyCoverLetterBtn.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard');
        }
    };

    let currentJobText = '';
    let currentCompanyName = '';
    let abortController = null; // For canceling fetch requests
    let coverLetterAbortController = null; // For canceling cover letter requests
    let isSending = false;
    let isGeneratingCoverLetter = false;

    // Initialize Copilot Auth
    const copilotAuth = new CopilotAuth();

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
                <p class="company-name"><strong>Visa:</strong> <span class="warning">⚠️ No company name detected</span></p>
            </div>`;
        }

        console.log('Checking visa sponsorship for company:', companyName);

        // Check if database has data
        const hasData = await checkIfDatabaseExists();

        if (!hasData) {
            return `<div class="visa-results visa-no-data">
                <p class="company-name">
                    <strong>Visa:</strong> <span id="visa-searched-company">${companyName}</span>
                    <button id="edit-company-name-btn" class="edit-company-btn" title="Edit company name">✏️</button>
                </p>
                <div id="edit-company-section" class="edit-company-section" style="display: none;">
                    <input type="text" id="edit-company-input" class="edit-company-input" value="${companyName}" placeholder="Enter company name">
                    <button id="search-edited-company-btn" class="search-edited-btn">Search</button>
                    <button id="cancel-edit-company-btn" class="cancel-edit-btn">Cancel</button>
                </div>
                <p class="warning" style="margin-top: 8px;">⚠️ No CSV data loaded. Upload in <a href="#" id="open-options-link">options</a>.</p>
            </div>`;
        }

        // Search for company in IndexedDB
        const matches = await searchCompaniesInIndexedDB(companyName);

        if (matches.length === 0) {
            return `<div class="visa-results visa-not-found">
                <p class="company-name">
                    <strong>Visa:</strong> <span id="visa-searched-company">${companyName}</span>
                    <button id="edit-company-name-btn" class="edit-company-btn" title="Edit company name">✏️</button>
                </p>
                <div id="edit-company-section" class="edit-company-section" style="display: none;">
                    <input type="text" id="edit-company-input" class="edit-company-input" value="${companyName}" placeholder="Enter company name">
                    <button id="search-edited-company-btn" class="search-edited-btn">Search</button>
                    <button id="cancel-edit-company-btn" class="cancel-edit-btn">Cancel</button>
                </div>
                <p class="status-not-found" style="margin-top: 8px;">❌ Not found in UK visa sponsorship register</p>
            </div>`;
        }

        // Found matches - display top results
        let html = `<div class="visa-results visa-found">
            <p class="company-name">
                <strong>Visa:</strong> <span id="visa-searched-company">${companyName}</span>
                <button id="edit-company-name-btn" class="edit-company-btn" title="Edit company name">✏️</button>
            </p>
            <div id="edit-company-section" class="edit-company-section" style="display: none;">
                <input type="text" id="edit-company-input" class="edit-company-input" value="${companyName}" placeholder="Enter company name">
                <button id="search-edited-company-btn" class="search-edited-btn">Search</button>
                <button id="cancel-edit-company-btn" class="cancel-edit-btn">Cancel</button>
            </div>`;

        // Show first match
        const firstMatch = matches[0];
        let matchQuality = '';
        if (firstMatch.matchScore >= 90) {
            matchQuality = '<span class="match-quality exact">Exact Match</span>';
        } else if (firstMatch.matchScore >= 80) {
            matchQuality = '<span class="match-quality high">High Match</span>';
        } else {
            matchQuality = '<span class="match-quality medium">Possible Match</span>';
        }

        html += `
            <div class="visa-record" id="visa-record-0">
                ${matchQuality}
                <div class="visa-record-title">
                    <strong>✅ ${firstMatch['Organisation Name'] || 'N/A'}</strong>
                    <span class="visa-location">${firstMatch['Town/City'] || 'N/A'}</span>
                </div>
                <div class="visa-record-details">
                    <div class="visa-field"><span class="label">County:</span> ${firstMatch['County'] || 'N/A'}</div>
                    <div class="visa-field"><span class="label">Type & Rating:</span> <span class="badge">${firstMatch['Type & Rating'] || 'N/A'}</span></div>
                    <div class="visa-field"><span class="label">Route:</span> <span class="badge route">${firstMatch['Route'] || 'N/A'}</span></div>
                </div>
            </div>
        `;

        // If there are more matches, show "Show more matches" button
        if (matches.length > 1) {
            html += `
                <div id="more-matches-section" class="more-matches-section">
                    <button id="show-more-matches-btn" class="show-more-matches-btn">
                        ▼ Show ${matches.length - 1} more ${matches.length - 1 === 1 ? 'match' : 'matches'}
                    </button>
                    <div id="more-matches-list" class="more-matches-list" style="display: none;">
            `;

            // Show remaining matches
            matches.slice(1).forEach((match, index) => {
                const actualIndex = index + 1;
                let matchQuality = '';
                if (match.matchScore >= 90) {
                    matchQuality = '<span class="match-quality exact">Exact Match</span>';
                } else if (match.matchScore >= 80) {
                    matchQuality = '<span class="match-quality high">High Match</span>';
                } else {
                    matchQuality = '<span class="match-quality medium">Possible Match</span>';
                }

                const recordId = `visa-record-${actualIndex}`;

                html += `
                    <div class="visa-record" id="${recordId}">
                        ${matchQuality}
                        <div class="visa-record-title">
                            <strong>${match['Organisation Name'] || 'N/A'}</strong>
                            <span class="visa-location">${match['Town/City'] || 'N/A'}</span>
                        </div>
                        <div class="visa-record-details">
                            <div class="visa-field"><span class="label">County:</span> ${match['County'] || 'N/A'}</div>
                            <div class="visa-field"><span class="label">Type & Rating:</span> <span class="badge">${match['Type & Rating'] || 'N/A'}</span></div>
                            <div class="visa-field"><span class="label">Route:</span> <span class="badge route">${match['Route'] || 'N/A'}</span></div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        html += `</div>`;
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
        let html = '<div class="keyword-results"><strong>Keywords:</strong> ';

        const keywordTags = keywordList.map(keyword => {
            const found = lowerJobText.includes(keyword.toLowerCase());
            const icon = found ? '✅' : '❌';
            const className = found ? 'keyword-found' : 'keyword-not-found';
            return `<span class="keyword-tag ${className}">${icon} ${keyword}</span>`;
        });

        html += keywordTags.join(' ');
        html += '</div>';
        return html;
    };

    // Check bad keywords in job text (inverse logic - found is bad, not found is good)
    const checkBadKeywords = (jobText, badKeywords) => {
        if (!badKeywords || !badKeywords.trim()) {
            return '';
        }

        const badKeywordList = badKeywords.split(',').map(k => k.trim()).filter(k => k);
        if (badKeywordList.length === 0) {
            return '';
        }

        const lowerJobText = jobText.toLowerCase();
        let html = '<div class="bad-keyword-results"><strong>Bad Keywords:</strong> ';

        const badKeywordTags = badKeywordList.map(keyword => {
            const found = lowerJobText.includes(keyword.toLowerCase());
            // Inverse logic: found = bad (red X), not found = good (green check)
            const icon = found ? '❌' : '✅';
            const className = found ? 'bad-keyword-found' : 'bad-keyword-not-found';
            return `<span class="bad-keyword-tag ${className}">${icon} ${keyword}</span>`;
        });

        html += badKeywordTags.join(' ');
        html += '</div>';
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
        const { AUTO_SEND_CHATGPT, SEARCH_KEYWORDS, BAD_KEYWORDS } = await chrome.storage.local.get(['AUTO_SEND_CHATGPT', 'SEARCH_KEYWORDS', 'BAD_KEYWORDS']);

        // Check visa sponsorship
        let visaHtml = '';
        try {
            visaHtml = await checkVisaSponsorship(companyName);
            console.log('Visa HTML generated, length:', visaHtml ? visaHtml.length : 0);
        } catch (error) {
            console.error('Error in checkVisaSponsorship:', error);
            visaHtml = `<div class="visa-results"><p class="warning">Error checking visa: ${error.message}</p></div>`;
        }

        // Display keyword search results
        let keywordHtml = '';
        try {
            keywordHtml = checkKeywords(currentJobText, SEARCH_KEYWORDS);
            console.log('Keyword HTML generated, length:', keywordHtml ? keywordHtml.length : 0);
        } catch (error) {
            console.error('Error in checkKeywords:', error);
            keywordHtml = `<div class="keyword-results"><p class="warning">Error checking keywords: ${error.message}</p></div>`;
        }

        // Display bad keyword search results
        let badKeywordHtml = '';
        try {
            badKeywordHtml = checkBadKeywords(currentJobText, BAD_KEYWORDS);
            console.log('Bad keyword HTML generated, length:', badKeywordHtml ? badKeywordHtml.length : 0);
        } catch (error) {
            console.error('Error in checkBadKeywords:', error);
            badKeywordHtml = `<div class="bad-keyword-results"><p class="warning">Error checking bad keywords: ${error.message}</p></div>`;
        }

        const combinedHtml = visaHtml + keywordHtml + badKeywordHtml;
        console.log('Combined HTML length:', combinedHtml.length);
        console.log('Combined HTML preview:', combinedHtml.substring(0, 300));

        if (AUTO_SEND_CHATGPT) {
            contentEl.innerHTML = combinedHtml + `<div class="muted" style="margin-top: 12px;">Sending to ChatGPT automatically...</div>`;
            // Automatically send to ChatGPT after data is loaded
            setTimeout(() => {
                sendToChatGPT();
            }, 500);
        } else {
            contentEl.innerHTML = combinedHtml;
        }

        console.log('Content element innerHTML set, length:', contentEl.innerHTML.length);

        // Attach event listeners for edit company name functionality
        try {
            attachVisaEventListeners();
            console.log('Event listeners attached');
        } catch (error) {
            console.error('Error attaching event listeners:', error);
        }

        // Update cover letter button state
        updateCoverLetterButtonState();
    };

    // Toggle more matches section
    const toggleMoreMatches = () => {
        const moreMatchesList = document.getElementById('more-matches-list');
        const btn = document.getElementById('show-more-matches-btn');

        if (!moreMatchesList || !btn) return;

        const isHidden = moreMatchesList.style.display === 'none';

        if (isHidden) {
            moreMatchesList.style.display = 'block';
            const count = moreMatchesList.querySelectorAll('.visa-record').length;
            btn.textContent = `▲ Hide ${count} ${count === 1 ? 'match' : 'matches'}`;
        } else {
            moreMatchesList.style.display = 'none';
            const count = moreMatchesList.querySelectorAll('.visa-record').length;
            btn.textContent = `▼ Show ${count} more ${count === 1 ? 'match' : 'matches'}`;
        }
    };

    // Attach event listeners for visa section
    const attachVisaEventListeners = () => {
        // Use event delegation for dynamically created elements
        contentEl.removeEventListener('click', handleVisaClicks);
        contentEl.addEventListener('click', handleVisaClicks);

        // Allow Enter key to search
        const input = document.getElementById('edit-company-input');
        if (input) {
            input.removeEventListener('keypress', handleEnterKey);
            input.addEventListener('keypress', handleEnterKey);
        }
    };

    // Handle all visa-related clicks with event delegation
    const handleVisaClicks = async (e) => {
        const target = e.target;

        // Edit company name button
        if (target.id === 'edit-company-name-btn' || target.closest('#edit-company-name-btn')) {
            const editSection = document.getElementById('edit-company-section');
            const searchedCompany = document.getElementById('visa-searched-company');
            const editBtn = document.getElementById('edit-company-name-btn');
            if (editSection && searchedCompany && editBtn) {
                editSection.style.display = 'flex';
                searchedCompany.style.display = 'none';
                editBtn.style.display = 'none';
                document.getElementById('edit-company-input').focus();
            }
            return;
        }

        // Cancel edit button
        if (target.id === 'cancel-edit-company-btn' || target.closest('#cancel-edit-company-btn')) {
            const editSection = document.getElementById('edit-company-section');
            const searchedCompany = document.getElementById('visa-searched-company');
            const editBtn = document.getElementById('edit-company-name-btn');
            if (editSection && searchedCompany && editBtn) {
                editSection.style.display = 'none';
                searchedCompany.style.display = 'inline';
                editBtn.style.display = 'inline';
            }
            return;
        }

        // Search edited company button
        if (target.id === 'search-edited-company-btn' || target.closest('#search-edited-company-btn')) {
            const input = document.getElementById('edit-company-input');
            if (input && input.value.trim()) {
                const newCompanyName = input.value.trim();

                // Update the current company name
                currentCompanyName = newCompanyName;

                // Re-run visa check with new company name
                const visaHtml = await checkVisaSponsorship(newCompanyName);

                // Get keywords HTML
                const { SEARCH_KEYWORDS, BAD_KEYWORDS } = await chrome.storage.local.get(['SEARCH_KEYWORDS', 'BAD_KEYWORDS']);
                const keywordHtml = checkKeywords(currentJobText, SEARCH_KEYWORDS);
                const badKeywordHtml = checkBadKeywords(currentJobText, BAD_KEYWORDS);

                // Update content
                contentEl.innerHTML = visaHtml + keywordHtml + badKeywordHtml;

                // Re-attach event listeners
                attachVisaEventListeners();
            }
            return;
        }

        // Show more matches button
        if (target.id === 'show-more-matches-btn' || target.closest('#show-more-matches-btn')) {
            toggleMoreMatches();
            return;
        }
    };

    // Handle Enter key in edit input
    const handleEnterKey = (e) => {
        if (e.key === 'Enter') {
            const searchBtn = document.getElementById('search-edited-company-btn');
            if (searchBtn) searchBtn.click();
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
        sendBtn.textContent = 'Stop AI';
        sendBtn.style.background = '#d32f2f';

        aiOutputEl.textContent = '';
        aiStatusEl.textContent = 'Sending to AI...';

        // Create new abort controller
        abortController = new AbortController();

        // Retrieve settings
        const { AI_PROVIDER, OPENAI_API_KEY, API_ENDPOINT, AI_MODEL, USER_PROMPT } = await chrome.storage.local.get(['AI_PROVIDER', 'OPENAI_API_KEY', 'API_ENDPOINT', 'AI_MODEL', 'USER_PROMPT']);

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

        if (!prompt) {
            aiStatusEl.textContent = 'No prompt. Set a prompt in options or add prompt.txt.';
            resetSendButton();
            return;
        }

        // Final prompt: append the job text at the end
        const fullPrompt = `${prompt.trim()}\n\n-----${currentJobText}`;

        const aiProvider = AI_PROVIDER || 'openai';

        try {
            let msg = '';

            if (aiProvider === 'copilot') {
                // Use GitHub Copilot
                aiStatusEl.textContent = 'Sending to GitHub Copilot...';
                console.log('Using GitHub Copilot');

                // Reset conversation for fresh context
                copilotAuth.resetConversation();

                try {
                    // Send to Copilot
                    msg = await copilotAuth.chat(fullPrompt, {
                        temperature: 0.2,
                        stream: true,
                        signal: abortController.signal
                    });
                } catch (copilotError) {
                    // Check if it's a subscription/access error
                    if (copilotError.message.includes('not enabled') ||
                        copilotError.message.includes('Access denied') ||
                        copilotError.message.includes('403')) {
                        aiStatusEl.innerHTML = `GitHub Copilot Error: ${copilotError.message}<br><br>` +
                            `<a href="options.html" target="_blank" style="color: #0073b1;">Open Options</a> to switch to OpenAI or Groq.`;
                        resetSendButton();
                        return;
                    }
                    throw copilotError; // Re-throw other errors
                }

            } else {
                // Use OpenAI
                if (!OPENAI_API_KEY) {
                    aiStatusEl.textContent = 'No API key. Open options and enter the key.';
                    resetSendButton();
                    return;
                }

                aiStatusEl.textContent = 'Sending to OpenAI...';
                const apiUrl = API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
                const aiModel = AI_MODEL || 'gpt-4o-mini';

                console.log('Send to OpenAI - API URL:', apiUrl);
                console.log('Send to OpenAI - AI Model:', aiModel);

                const resp = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: aiModel,
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

                msg = data?.choices?.[0]?.message?.content?.trim() || '(empty response)';
            }

            aiStatusEl.textContent = 'Done ✓';
            aiOutputEl.innerHTML = msg.replace(/\n/g, '<br>');

            // Reset button after successful response
            resetSendButton();

        } catch (err) {
            console.error(err);
            if (err.name === 'AbortError') {
                aiStatusEl.textContent = 'Request cancelled.';
            } else {
                aiStatusEl.textContent = `Error: ${err.message}`;
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

    // Reset cover letter button to original state
    const resetCoverLetterButton = () => {
        isGeneratingCoverLetter = false;
        generateCoverLetterBtn.textContent = 'Generate Cover Letter';
        generateCoverLetterBtn.style.background = '';
        coverLetterAbortController = null;
        updateCoverLetterButtonState();
    };

    // Update cover letter button state based on conditions
    const updateCoverLetterButtonState = async () => {
        const { RESUME_TEXT } = await chrome.storage.local.get(['RESUME_TEXT']);
        const hasResume = RESUME_TEXT && RESUME_TEXT.length > 0;
        const hasJobData = currentJobText && currentJobText.length > 0;

        generateCoverLetterBtn.disabled = !hasResume || !hasJobData || isGeneratingCoverLetter;

        if (!hasResume) {
            generateCoverLetterBtn.title = 'Please upload a resume in options';
        } else if (!hasJobData) {
            generateCoverLetterBtn.title = 'Please load job data first';
        } else {
            generateCoverLetterBtn.title = 'Generate a tailored cover letter';
        }
    };

    // Function to generate cover letter
    const generateCoverLetter = async () => {
        if (!currentJobText) {
            coverLetterStatus.textContent = 'No job data available.';
            return;
        }

        // Get resume from storage
        const { AI_PROVIDER, RESUME_TEXT, OPENAI_API_KEY, API_ENDPOINT, AI_MODEL } = await chrome.storage.local.get(['AI_PROVIDER', 'RESUME_TEXT', 'OPENAI_API_KEY', 'API_ENDPOINT', 'AI_MODEL']);

        console.log('Cover letter generation - AI_PROVIDER:', AI_PROVIDER);
        console.log('Cover letter generation - API_ENDPOINT:', API_ENDPOINT);
        console.log('Cover letter generation - AI_MODEL:', AI_MODEL);
        console.log('Cover letter generation - OPENAI_API_KEY:', OPENAI_API_KEY ? 'Present' : 'Missing');
        console.log('Cover letter generation - RESUME_TEXT length:', RESUME_TEXT ? RESUME_TEXT.length : 0);

        if (!RESUME_TEXT) {
            coverLetterStatus.textContent = 'No resume uploaded. Please upload your resume in options.';
            coverLetterStatus.style.color = '#c62828';
            return;
        }

        const aiProvider = AI_PROVIDER || 'openai';

        if (aiProvider === 'openai' && !OPENAI_API_KEY) {
            coverLetterStatus.textContent = 'No OpenAI API key configured. Please add it in options.';
            coverLetterStatus.style.color = '#c62828';
            return;
        }

        // Show cover letter container and expand it
        coverLetterContainer.style.display = 'block';
        coverLetterContent.style.display = 'block';
        toggleCoverLetterBtn.textContent = 'Hide';

        // Change button to "Stop Generation"
        isGeneratingCoverLetter = true;
        generateCoverLetterBtn.textContent = 'Stop Generation';
        generateCoverLetterBtn.style.background = '#d32f2f';

        coverLetterText.textContent = '';
        coverLetterStatus.textContent = 'Generating cover letter...';
        coverLetterStatus.style.color = '#0073b1';
        copyCoverLetterBtn.style.display = 'none';

        // Create new abort controller
        coverLetterAbortController = new AbortController();

        // Create cover letter prompt
        const coverLetterPrompt = `You are a professional career advisor. Based on the following resume and job description, write a compelling, professional cover letter.

RESUME:
${RESUME_TEXT}

JOB DESCRIPTION:
${currentJobText}

Please write a cover letter that:
1. Is professional and well-structured
2. Highlights relevant experience from the resume that matches the job requirements
3. Shows genuine enthusiasm for the position
4. Is concise (around 300-400 words)
5. Follows standard cover letter format (greeting, body paragraphs, closing)
6. Uses a confident but not arrogant tone
7. Addresses specific requirements mentioned in the job description

Write only the cover letter text, without any additional commentary or explanations.`;

        try {
            let coverLetter = '';

            if (aiProvider === 'copilot') {
                // Use GitHub Copilot
                coverLetterStatus.textContent = 'Generating with GitHub Copilot...';
                console.log('Using GitHub Copilot for cover letter');

                // Reset conversation for fresh context
                copilotAuth.resetConversation();

                try {
                    coverLetter = await copilotAuth.chat(coverLetterPrompt, {
                        temperature: 0.7,
                        stream: true,
                        signal: coverLetterAbortController.signal
                    });
                } catch (copilotError) {
                    // Check if it's a subscription/access error
                    if (copilotError.message.includes('not enabled') ||
                        copilotError.message.includes('Access denied') ||
                        copilotError.message.includes('403')) {
                        coverLetterStatus.innerHTML = `GitHub Copilot Error: ${copilotError.message}<br><br>` +
                            `<a href="options.html" target="_blank" style="color: #0073b1;">Open Options</a> to switch to OpenAI or Groq.`;
                        coverLetterStatus.style.color = '#c62828';
                        resetCoverLetterButton();
                        return;
                    }
                    throw copilotError; // Re-throw other errors
                }

            } else {
                // Use OpenAI
                const apiUrl = API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
                const aiModel = AI_MODEL || 'gpt-4o-mini';

                console.log('Cover letter generation - Using API URL:', apiUrl);
                console.log('Cover letter generation - Using AI Model:', aiModel);

                const resp = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: aiModel,
                        messages: [
                            { role: 'user', content: coverLetterPrompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 1000
                    }),
                    signal: coverLetterAbortController.signal
                });

                if (!resp.ok) {
                    const errorData = await resp.json().catch(() => ({}));
                    throw new Error(errorData.error?.message || `HTTP ${resp.status}`);
                }

                const data = await resp.json();
                coverLetter = data?.choices?.[0]?.message?.content?.trim() || '(empty response)';
            }

            coverLetterStatus.textContent = 'Cover letter generated ✓';
            coverLetterStatus.style.color = '#2e7d32';
            coverLetterText.textContent = coverLetter;
            copyCoverLetterBtn.style.display = 'block';

            // Reset button after successful response
            resetCoverLetterButton();

        } catch (err) {
            console.error('Cover letter generation error:', err);
            if (err.name === 'AbortError') {
                coverLetterStatus.textContent = 'Generation cancelled.';
                coverLetterStatus.style.color = '#666';
            } else {
                coverLetterStatus.textContent = 'Error: ' + err.message;
                coverLetterStatus.style.color = '#c62828';
            }
            resetCoverLetterButton();
        }
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

    // Generate cover letter button handler
    generateCoverLetterBtn.onclick = () => {
        if (isGeneratingCoverLetter && coverLetterAbortController) {
            // Stop the generation
            coverLetterAbortController.abort();
            resetCoverLetterButton();
        } else {
            // Generate cover letter
            generateCoverLetter();
        }
    };

    // Initialize: request job data from current tab
    setStatus('Initializing...');
    setTimeout(requestJobDataFromTab, 500);

    // Initialize cover letter button state
    updateCoverLetterButtonState();

})();

