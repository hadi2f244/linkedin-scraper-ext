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
    const coverLetterStatus = $('#cover-letter-status-text');
    const editableIndicator = $('#editable-indicator');
    const coverLetterText = $('#cover-letter-text');
    const copyCoverLetterBtn = $('#copy-cover-letter');
    const savePdfCoverLetterBtn = $('#save-pdf-cover-letter');

    // Tab elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Q&A elements
    const questionSelect = $('#question-select');
    const qaStatus = $('#qa-status-text');
    const qaAnswer = $('#qa-answer');
    const customQuestionInput = $('#custom-question');
    const askCustomQuestionBtn = $('#ask-custom-question');
    const customAnswer = $('#custom-answer');

    // Company Research elements
    const researchCompanyBtn = $('#research-company-btn');
    const companyResearchStatus = $('#company-research-status-text');
    const companyResearchResult = $('#company-research-result');
    const companyResearchName = $('#company-research-name');
    const companyResearchContent = $('#company-research-content');
    const companyResearchTimestamp = $('#company-research-timestamp');
    const companyResearchSources = $('#company-research-sources');
    const companyResearchError = $('#company-research-error');
    const customUrlsInput = $('#custom-urls-input');
    const clearCustomUrlsBtn = $('#clear-custom-urls-btn');
    const companyResearchProgress = $('#company-research-progress');
    const progressLinkedin = $('#progress-linkedin');
    const progressWebsite = $('#progress-website');
    const progressCustom = $('#progress-custom');
    const manualContentInput = $('#manual-content-input');
    const manualContentSection = $('#manual-content-section');
    const toggleManualContentBtn = $('#toggle-manual-content');
    const clearManualContentBtn = $('#clear-manual-content-btn');

    // Tab switching logic
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

    // Toggle cover letter button removed - cover letter is now in its own tab

    // Load questions into dropdown
    const loadQuestionsDropdown = async () => {
        const { APPLICATION_QUESTIONS } = await chrome.storage.local.get(['APPLICATION_QUESTIONS']);

        // Clear existing options except the first one
        questionSelect.innerHTML = '<option value="">-- Select a question --</option>';

        if (!APPLICATION_QUESTIONS || APPLICATION_QUESTIONS.trim() === '') {
            return;
        }

        // Parse questions
        const questionLines = APPLICATION_QUESTIONS.split('\n').filter(line => line.trim() && line.includes('|'));
        questionLines.forEach((line, index) => {
            const [question] = line.split('|').map(s => s.trim());
            const option = document.createElement('option');
            option.value = index;
            option.textContent = question;
            questionSelect.appendChild(option);
        });
    };

    // Handle question selection - populate custom question field with the prompt
    questionSelect.addEventListener('change', async () => {
        const selectedIndex = questionSelect.value;

        if (!selectedIndex) {
            // Clear custom question field when "-- Select a question --" is chosen
            customQuestionInput.value = '';
            qaAnswer.innerHTML = '';
            qaStatus.textContent = '';
            return;
        }

        // Get questions from storage
        const { APPLICATION_QUESTIONS } = await chrome.storage.local.get(['APPLICATION_QUESTIONS']);

        if (!APPLICATION_QUESTIONS) {
            qaStatus.textContent = 'No questions configured';
            qaStatus.style.color = '#c62828';
            return;
        }

        // Parse questions
        const questionLines = APPLICATION_QUESTIONS.split('\n').filter(line => line.trim() && line.includes('|'));
        const [question, prompt] = questionLines[selectedIndex].split('|').map(s => s.trim());

        // Populate the custom question field with the prompt
        customQuestionInput.value = prompt;

        // Clear any previous answer
        qaAnswer.innerHTML = '';
        customAnswer.innerHTML = '';
        customAnswer.style.display = 'none';

        // Show instruction to user
        qaStatus.textContent = `Prompt loaded for: "${question}". Review and click "Get Answer" to generate.`;
        qaStatus.style.color = '#0073b1';
    });

    // Load questions on startup
    loadQuestionsDropdown();

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

    // Handle save as PDF button
    savePdfCoverLetterBtn.onclick = async () => {
        try {
            // Get current date in YYYY-MM-DD format
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];

            // Sanitize company name and job title for filename
            const sanitize = (str) => {
                return str.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
            };

            const companyName = sanitize(currentCompanyName || 'Company');
            const jobTitle = sanitize(currentJobTitle || 'Position');
            const filename = `CoverLetter_${companyName}_${jobTitle}_${dateStr}.pdf`;

            // Create a temporary container for the PDF content
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert('Please allow popups to save as PDF');
                return;
            }

            // Get the cover letter text and convert newlines to HTML
            // The text is stored as plain text with \n for newlines
            // We need to convert it to HTML paragraphs for proper PDF formatting
            const coverLetterPlainText = coverLetterText.textContent || '';

            // Split by double newlines to get paragraphs, then wrap each in <p> tags
            // Also handle single newlines within paragraphs as <br> tags
            const paragraphs = coverLetterPlainText
                .split(/\n\n+/)  // Split on double newlines (paragraph breaks)
                .map(para => {
                    // Replace single newlines with <br> tags
                    const formatted = para.trim().replace(/\n/g, '<br>');
                    return formatted ? `<p>${formatted}</p>` : '';
                })
                .filter(p => p)  // Remove empty paragraphs
                .join('\n');

            // Write the cover letter content to the new window
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${filename}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            max-width: 800px;
                            margin: 40px auto;
                            padding: 20px;
                            color: #333;
                        }
                        p {
                            margin-bottom: 16px;
                            text-align: left;
                        }
                        @media print {
                            body {
                                margin: 0;
                                padding: 20px;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${paragraphs}
                </body>
                </html>
            `);

            printWindow.document.close();

            // Wait for content to load, then trigger print dialog
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    // Note: The window will close automatically after printing or canceling
                    // We don't close it immediately to allow the user to save as PDF
                }, 100);
            };

            // Update button text temporarily
            const originalText = savePdfCoverLetterBtn.textContent;
            savePdfCoverLetterBtn.textContent = '✓ Opening print dialog...';
            setTimeout(() => {
                savePdfCoverLetterBtn.textContent = originalText;
            }, 3000);

        } catch (err) {
            console.error('Failed to save as PDF:', err);
            alert('Failed to save as PDF. Please try again.');
        }
    };

    let currentJobText = '';
    let currentCompanyName = '';
    let currentJobTitle = '';
    let currentCompanyUrl = ''; // LinkedIn company page URL
    let currentCompanyResearch = ''; // Stores the compiled company research data
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
                    if (!db.objectStoreNames.contains('jobCache')) {
                        const jobCacheStore = db.createObjectStore('jobCache', { keyPath: 'jobId' });
                        jobCacheStore.createIndex('timestamp', 'timestamp', { unique: false });
                    }

                    if (!db.objectStoreNames.contains('jobTracking')) {
                        const jobTrackingStore = db.createObjectStore('jobTracking', { keyPath: 'jobId' });
                        jobTrackingStore.createIndex('viewedAt', 'viewedAt', { unique: false });
                        jobTrackingStore.createIndex('appliedAt', 'appliedAt', { unique: false });
                    }
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
        const score = firstMatch.matchScore || firstMatch.confidence || 0;
        let matchQuality = '';
        let matchDescription = '';

        if (score === 100) {
            matchQuality = '<span class="match-quality exact">✓ Exact Match</span>';
            matchDescription = 'This company is in the UK visa sponsorship register';
        } else if (score >= 95) {
            matchQuality = '<span class="match-quality exact">✓ Exact Match (95%+)</span>';
            matchDescription = 'Very high confidence - core company name matches exactly';
        } else if (score >= 85) {
            matchQuality = '<span class="match-quality high">~ High Match (85%+)</span>';
            matchDescription = 'High confidence - similar company name found in register';
        } else {
            matchQuality = '<span class="match-quality medium">~ Possible Match</span>';
            matchDescription = 'Moderate confidence - company name is similar';
        }

        html += `
            <div class="visa-record" id="visa-record-0">
                ${matchQuality}
                <p class="match-description" style="font-size: 12px; color: #666; margin: 4px 0 8px 0;">${matchDescription}</p>
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
                const score = match.matchScore || match.confidence || 0;
                let matchQuality = '';

                if (score === 100) {
                    matchQuality = '<span class="match-quality exact">✓ Exact Match</span>';
                } else if (score >= 95) {
                    matchQuality = '<span class="match-quality exact">✓ Exact Match (95%+)</span>';
                } else if (score >= 85) {
                    matchQuality = '<span class="match-quality high">~ High Match (85%+)</span>';
                } else {
                    matchQuality = '<span class="match-quality medium">~ Possible Match</span>';
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
        let jobText, companyName, jobTitle, companyUrl;
        if (typeof jobData === 'string') {
            jobText = jobData;
            companyName = '';
            jobTitle = '';
            companyUrl = '';
        } else if (jobData && typeof jobData === 'object') {
            jobText = jobData.text;
            companyName = jobData.companyName || '';
            jobTitle = jobData.jobTitle || '';
            companyUrl = jobData.companyUrl || '';
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
        currentJobTitle = jobTitle;
        currentCompanyUrl = companyUrl;

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
            const errorMsg = error?.message || String(error);
            visaHtml = `<div class="visa-results"><p class="warning">Error checking visa: ${errorMsg}</p></div>`;
        }

        // Display keyword search results
        let keywordHtml = '';
        try {
            keywordHtml = checkKeywords(currentJobText, SEARCH_KEYWORDS);
            console.log('Keyword HTML generated, length:', keywordHtml ? keywordHtml.length : 0);
        } catch (error) {
            console.error('Error in checkKeywords:', error);
            const errorMsg = error?.message || String(error);
            keywordHtml = `<div class="keyword-results"><p class="warning">Error checking keywords: ${errorMsg}</p></div>`;
        }

        // Display bad keyword search results
        let badKeywordHtml = '';
        try {
            badKeywordHtml = checkBadKeywords(currentJobText, BAD_KEYWORDS);
            console.log('Bad keyword HTML generated, length:', badKeywordHtml ? badKeywordHtml.length : 0);
        } catch (error) {
            console.error('Error in checkBadKeywords:', error);
            const errorMsg = error?.message || String(error);
            badKeywordHtml = `<div class="bad-keyword-results"><p class="warning">Error checking bad keywords: ${errorMsg}</p></div>`;
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

        // Enable company research button
        researchCompanyBtn.disabled = false;

        // Load custom URLs for this company
        const customUrlsKey = `CUSTOM_URLS_${companyName}`;
        const { [customUrlsKey]: savedCustomUrls } = await chrome.storage.local.get([customUrlsKey]);
        if (savedCustomUrls && savedCustomUrls.length > 0) {
            customUrlsInput.value = savedCustomUrls.join('\n');
            console.log('[Company Research] Loaded custom URLs:', savedCustomUrls.length);
        } else {
            customUrlsInput.value = '';
        }

        // Check if we have cached company research for this company
        const cacheKey = `COMPANY_RESEARCH_${companyName}`;
        const { [cacheKey]: cachedResearch } = await chrome.storage.local.get([cacheKey]);
        if (cachedResearch && cachedResearch.timestamp) {
            const age = Date.now() - cachedResearch.timestamp;
            // Auto-load cached data if less than 24 hours old
            if (age < 24 * 60 * 60 * 1000) {
                console.log('[Company Research] Auto-loading cached data');
                displayCompanyResearch(cachedResearch);
            }
        }
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
            console.log('[Side Panel] Requesting job data from tab...');
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.url) {
                console.error('[Side Panel] No active tab found');
                setError('No active tab found.');
                return;
            }

            console.log('[Side Panel] Active tab URL:', tab.url);
            const url = new URL(tab.url);
            if (!url.hostname.includes('linkedin.com') || !url.pathname.startsWith('/jobs')) {
                console.warn('[Side Panel] Not a LinkedIn jobs page');
                setStatus('Please navigate to a LinkedIn job page.', true);
                return;
            }

            setStatus('Fetching job data...');
            console.log('[Side Panel] Sending REQUEST_JOB_DATA message to tab', tab.id);

            // Send message to content script to get current job data
            chrome.tabs.sendMessage(tab.id, { type: 'REQUEST_JOB_DATA' }, async (response) => {
                if (chrome.runtime.lastError) {
                    const errorMsg = chrome.runtime.lastError?.message || String(chrome.runtime.lastError);
                    console.error('[Side Panel] Error sending message:', errorMsg);

                    // Try to get the last job data from chrome.storage as fallback
                    console.log('[Side Panel] Trying to get last job data from storage...');
                    try {
                        const { LAST_JOB_DATA, LAST_JOB_DATA_TIMESTAMP } = await chrome.storage.local.get(['LAST_JOB_DATA', 'LAST_JOB_DATA_TIMESTAMP']);

                        if (LAST_JOB_DATA && LAST_JOB_DATA_TIMESTAMP) {
                            const age = Date.now() - LAST_JOB_DATA_TIMESTAMP;
                            console.log(`[Side Panel] Found cached job data (age: ${Math.round(age / 1000)}s)`);

                            // Only use cached data if it's less than 30 seconds old and matches current URL
                            if (age < 30000 && LAST_JOB_DATA.url === tab.url) {
                                console.log('[Side Panel] Using cached job data');
                                displayJobData(LAST_JOB_DATA);
                                return;
                            } else {
                                console.log('[Side Panel] Cached data is too old or URL mismatch');
                            }
                        }
                    } catch (err) {
                        console.error('[Side Panel] Failed to get cached job data:', err);
                    }

                    // Check if it's a "Could not establish connection" error (content script not loaded)
                    if (errorMsg.includes('Could not establish connection')) {
                        setError('Content script not loaded. Please refresh the LinkedIn page.');
                    } else {
                        setError('Could not connect to LinkedIn page. Try refreshing the page.');
                    }
                    return;
                }

                console.log('[Side Panel] Received response:', response);
                if (response && response.success && response.data) {
                    console.log('[Side Panel] Received job data from manual refresh:', response.data);
                    console.log('[Side Panel] Company name from manual refresh:', response.data.companyName);
                    // Pass the entire data object, not just the text
                    displayJobData(response.data);
                } else {
                    console.warn('[Side Panel] No job data in response');
                    setStatus('No job details found. Click on a job listing.', true);
                }
            });

        } catch (e) {
            console.error('[Side Panel] Error in requestJobDataFromTab:', e);
            const errorMsg = e?.message || String(e);
            setError('Error fetching job data: ' + errorMsg);
        }
    };

    // Listen for messages from content script (automatic updates)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[Side Panel] Received message:', message.type);

        if (message.type === 'JOB_DATA_UPDATED' && message.data) {
            console.log('[Side Panel] Received job data update from content script');
            console.log('[Side Panel] Message data:', message.data);
            console.log('[Side Panel] Company name in message:', message.data.companyName);
            // Pass the entire data object, not just the text
            displayJobData(message.data);
            sendResponse({ received: true });
        }
        return true; // Keep message channel open
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
                    const copilotErrorMsg = copilotError?.message || String(copilotError);
                    if (copilotErrorMsg.includes('not enabled') ||
                        copilotErrorMsg.includes('Access denied') ||
                        copilotErrorMsg.includes('403')) {
                        aiStatusEl.innerHTML = `GitHub Copilot Error: ${copilotErrorMsg}<br><br>` +
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
                const errorMsg = err?.message || String(err);
                aiStatusEl.textContent = `Error: ${errorMsg}`;
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

        // Get resume and custom prompt from storage
        const { AI_PROVIDER, RESUME_TEXT, OPENAI_API_KEY, API_ENDPOINT, AI_MODEL, COVER_LETTER_PROMPT } = await chrome.storage.local.get(['AI_PROVIDER', 'RESUME_TEXT', 'OPENAI_API_KEY', 'API_ENDPOINT', 'AI_MODEL', 'COVER_LETTER_PROMPT']);

        console.log('Cover letter generation - AI_PROVIDER:', AI_PROVIDER);
        console.log('Cover letter generation - API_ENDPOINT:', API_ENDPOINT);
        console.log('Cover letter generation - AI_MODEL:', AI_MODEL);
        console.log('Cover letter generation - OPENAI_API_KEY:', OPENAI_API_KEY ? 'Present' : 'Missing');
        console.log('Cover letter generation - RESUME_TEXT length:', RESUME_TEXT ? RESUME_TEXT.length : 0);
        console.log('Cover letter generation - COVER_LETTER_PROMPT:', COVER_LETTER_PROMPT ? 'Custom prompt loaded' : 'Using default');

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

        // Show cover letter container
        coverLetterContainer.style.display = 'block';

        // Change button to "Stop Generation"
        isGeneratingCoverLetter = true;
        generateCoverLetterBtn.textContent = 'Stop Generation';
        generateCoverLetterBtn.style.background = '#d32f2f';

        coverLetterText.textContent = '';
        coverLetterText.removeAttribute('contenteditable');
        editableIndicator.style.display = 'none';
        coverLetterStatus.textContent = 'Generating cover letter...';
        coverLetterStatus.style.color = '#0073b1';
        copyCoverLetterBtn.style.display = 'none';
        savePdfCoverLetterBtn.style.display = 'none';

        // Create new abort controller
        coverLetterAbortController = new AbortController();

        // Create cover letter prompt with variable replacement
        let coverLetterPrompt = COVER_LETTER_PROMPT || `You are a professional career advisor. Based on the following resume and job description, write a compelling, professional cover letter.

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

        // Replace variables in the prompt
        coverLetterPrompt = coverLetterPrompt
            .replace(/{resume}/g, RESUME_TEXT || '')
            .replace(/{job_title}/g, currentJobTitle || 'this position')
            .replace(/{company_name}/g, currentCompanyName || 'the company')
            .replace(/{job_description}/g, currentJobText || '');

        console.log('Cover letter prompt after variable replacement (first 200 chars):', coverLetterPrompt.substring(0, 200));

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
                    const copilotErrorMsg = copilotError?.message || String(copilotError);
                    if (copilotErrorMsg.includes('not enabled') ||
                        copilotErrorMsg.includes('Access denied') ||
                        copilotErrorMsg.includes('403')) {
                        coverLetterStatus.innerHTML = `GitHub Copilot Error: ${copilotErrorMsg}<br><br>` +
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

            // Make the cover letter editable
            coverLetterText.setAttribute('contenteditable', 'true');
            coverLetterText.setAttribute('spellcheck', 'true');
            editableIndicator.style.display = 'inline-block';

            copyCoverLetterBtn.style.display = 'block';
            savePdfCoverLetterBtn.style.display = 'block';

            // Reset button after successful response
            resetCoverLetterButton();

        } catch (err) {
            console.error('Cover letter generation error:', err);
            if (err.name === 'AbortError') {
                coverLetterStatus.textContent = 'Generation cancelled.';
                coverLetterStatus.style.color = '#666';
            } else {
                const errorMsg = err?.message || String(err);
                coverLetterStatus.textContent = 'Error: ' + errorMsg;
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

    // Company Research function
    const researchCompany = async (forceRefresh = false) => {
        if (!currentCompanyName) {
            companyResearchError.textContent = 'No company name available. Please load a job first.';
            companyResearchError.style.display = 'block';
            companyResearchResult.style.display = 'none';
            return;
        }

        // Get custom URLs from input
        const customUrlsText = customUrlsInput.value.trim();
        const customUrls = customUrlsText ? customUrlsText.split('\n').map(url => url.trim()).filter(url => url) : [];

        // Get manual content from input
        const manualContent = manualContentInput.value.trim();

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cacheKey = `COMPANY_RESEARCH_${currentCompanyName}`;
            const { [cacheKey]: cachedData } = await chrome.storage.local.get([cacheKey]);

            if (cachedData && cachedData.timestamp) {
                const age = Date.now() - cachedData.timestamp;

                // Check if custom URLs or manual content have changed
                const cachedUrls = cachedData.customUrls || [];
                const cachedManualContent = cachedData.manualContent || '';
                const urlsChanged = JSON.stringify(cachedUrls.sort()) !== JSON.stringify(customUrls.sort());
                const manualContentChanged = cachedManualContent !== manualContent;

                // Use cache if less than 24 hours old AND custom URLs AND manual content haven't changed
                if (age < 24 * 60 * 60 * 1000 && !urlsChanged && !manualContentChanged) {
                    console.log('[Company Research] Using cached data (age:', Math.round(age / 1000 / 60), 'minutes)');
                    displayCompanyResearch(cachedData);
                    return;
                } else if (urlsChanged) {
                    console.log('[Company Research] Custom URLs changed, invalidating cache');
                } else if (manualContentChanged) {
                    console.log('[Company Research] Manual content changed, invalidating cache');
                }
            }
        }

        // Show loading state
        researchCompanyBtn.disabled = true;
        researchCompanyBtn.textContent = '⏳ Researching...';
        companyResearchStatus.textContent = 'Gathering company information...';
        companyResearchStatus.style.color = '#0073b1';
        companyResearchError.style.display = 'none';
        companyResearchResult.style.display = 'none';
        companyResearchProgress.style.display = 'block';

        // Reset progress indicators
        progressLinkedin.innerHTML = '⏳ Fetching LinkedIn company page...';
        progressWebsite.innerHTML = '⏳ Fetching company website...';
        progressCustom.innerHTML = customUrls.length > 0 ? `⏳ Fetching ${customUrls.length} custom URL${customUrls.length > 1 ? 's' : ''}...` : '⏭️ No custom URLs';

        try {
            console.log('[Company Research] Starting research for:', currentCompanyName);
            console.log('[Company Research] Company URL:', currentCompanyUrl);
            console.log('[Company Research] Custom URLs:', customUrls);
            console.log('[Company Research] Manual content length:', manualContent.length, 'chars');

            // Send message to background script to research company
            const response = await chrome.runtime.sendMessage({
                type: 'RESEARCH_COMPANY',
                companyName: currentCompanyName,
                companyUrl: currentCompanyUrl,
                jobDescription: currentJobText,
                customUrls: customUrls,
                manualContent: manualContent
            });

            if (response.success) {
                console.log('[Company Research] Research completed successfully');

                // Update progress indicators based on results
                if (response.linkedinSuccess) {
                    progressLinkedin.innerHTML = '✅ LinkedIn company page fetched';
                } else {
                    progressLinkedin.innerHTML = '❌ LinkedIn company page failed: ' + (response.linkedinError || 'Unknown error');
                }

                if (response.websiteSuccess) {
                    progressWebsite.innerHTML = '✅ Company website fetched';
                } else if (response.websiteUrl) {
                    progressWebsite.innerHTML = '❌ Company website failed: ' + (response.websiteError || 'Unknown error');
                } else {
                    progressWebsite.innerHTML = '⏭️ No website URL found';
                }

                if (customUrls.length > 0) {
                    const successCount = response.customUrlsSuccess || 0;
                    progressCustom.innerHTML = `✅ ${successCount}/${customUrls.length} custom URLs fetched`;
                } else {
                    progressCustom.innerHTML = '⏭️ No custom URLs';
                }

                // Store in cache (including custom URLs)
                const cacheKey = `COMPANY_RESEARCH_${currentCompanyName}`;
                const cacheData = {
                    companyName: currentCompanyName,
                    description: response.description,
                    sources: response.sources,
                    customUrls: customUrls,
                    manualContent: manualContent,
                    timestamp: Date.now()
                };
                await chrome.storage.local.set({ [cacheKey]: cacheData });

                // Also save custom URLs for this company
                const customUrlsKey = `CUSTOM_URLS_${currentCompanyName}`;
                await chrome.storage.local.set({ [customUrlsKey]: customUrls });

                // Display results
                displayCompanyResearch(cacheData);

                // Update global variable for use in Q&A
                currentCompanyResearch = response.description;

            } else {
                throw new Error(response.error || 'Failed to research company');
            }

        } catch (error) {
            console.error('[Company Research] Error:', error);
            const errorMsg = error?.message || String(error);
            companyResearchError.textContent = `Error: ${errorMsg}`;
            companyResearchError.style.display = 'block';
            companyResearchStatus.textContent = '';
            companyResearchProgress.style.display = 'none';
        } finally {
            researchCompanyBtn.disabled = false;
            researchCompanyBtn.textContent = '🔍 Research Company';
        }
    };

    // Display company research results
    const displayCompanyResearch = (data) => {
        companyResearchName.textContent = data.companyName;
        companyResearchContent.textContent = data.description;

        // Display sources
        if (data.sources && data.sources.length > 0) {
            companyResearchSources.textContent = `Sources: ${data.sources.join(', ')}`;
        } else {
            companyResearchSources.textContent = 'Sources: Job Description';
        }

        const date = new Date(data.timestamp);
        companyResearchTimestamp.textContent = `Last updated: ${date.toLocaleString()}`;

        companyResearchResult.style.display = 'block';
        companyResearchStatus.textContent = '✓ Research completed';
        companyResearchStatus.style.color = '#2e7d32';
        companyResearchProgress.style.display = 'none';

        // Update global variable
        currentCompanyResearch = data.description;

        // Load custom URLs if they exist
        if (data.customUrls && data.customUrls.length > 0) {
            customUrlsInput.value = data.customUrls.join('\n');
        }
    };

    // Research company button handler - always force refresh
    researchCompanyBtn.onclick = () => researchCompany(true);

    // Clear custom URLs button handler
    clearCustomUrlsBtn.onclick = async () => {
        customUrlsInput.value = '';
        // Also clear from storage
        if (currentCompanyName) {
            const customUrlsKey = `CUSTOM_URLS_${currentCompanyName}`;
            await chrome.storage.local.remove(customUrlsKey);
            console.log('[Company Research] Custom URLs cleared');
        }
    };

    // Toggle manual content section
    toggleManualContentBtn.onclick = () => {
        if (manualContentSection.style.display === 'none') {
            manualContentSection.style.display = 'block';
            toggleManualContentBtn.textContent = 'Hide';
        } else {
            manualContentSection.style.display = 'none';
            toggleManualContentBtn.textContent = 'Show';
        }
    };

    // Clear manual content button handler
    clearManualContentBtn.onclick = () => {
        manualContentInput.value = '';
    };

    // Custom question handler
    askCustomQuestionBtn.onclick = async () => {
        const customQuestionText = customQuestionInput.value.trim();

        if (!customQuestionText) {
            customAnswer.innerHTML = '<div style="color: #c62828;">Please enter a question.</div>';
            customAnswer.style.display = 'block';
            return;
        }

        if (!currentJobText) {
            customAnswer.innerHTML = '<div style="color: #c62828;">No job data available.</div>';
            customAnswer.style.display = 'block';
            return;
        }

        // Get resume and API settings from storage
        const { AI_PROVIDER, RESUME_TEXT, OPENAI_API_KEY, API_ENDPOINT, AI_MODEL } = await chrome.storage.local.get(['AI_PROVIDER', 'RESUME_TEXT', 'OPENAI_API_KEY', 'API_ENDPOINT', 'AI_MODEL']);

        if (!RESUME_TEXT) {
            customAnswer.innerHTML = '<div style="color: #c62828;">No resume uploaded. Please upload your resume in options.</div>';
            customAnswer.style.display = 'block';
            return;
        }

        const aiProvider = AI_PROVIDER || 'openai';

        if (aiProvider === 'openai' && !OPENAI_API_KEY) {
            customAnswer.innerHTML = '<div style="color: #c62828;">No OpenAI API key configured. Please add it in options.</div>';
            customAnswer.style.display = 'block';
            return;
        }

        // Show loading state
        customAnswer.innerHTML = '<div style="color: #0073b1;">Generating answer...</div>';
        customAnswer.style.display = 'block';
        askCustomQuestionBtn.disabled = true;
        askCustomQuestionBtn.textContent = 'Generating...';

        try {
            // Check if prompt requires company research
            if (/{company_research}|{company_description}/.test(customQuestionText)) {
                if (!currentCompanyResearch) {
                    customAnswer.innerHTML = `
                        <div style="color: #c62828; padding: 12px; background: #ffebee; border-radius: 4px;">
                            <div style="font-weight: 600; margin-bottom: 8px;">⚠️ Company Research Required</div>
                            <div style="margin-bottom: 8px;">This question requires company research data. Please complete the 'Company Research' tab first.</div>
                            <button id="goto-company-research" class="copy-btn" style="margin-top: 8px;">Go to Company Research →</button>
                        </div>
                    `;
                    customAnswer.style.display = 'block';

                    // Add click handler to navigate to company research tab
                    setTimeout(() => {
                        const gotoBtn = document.getElementById('goto-company-research');
                        if (gotoBtn) {
                            gotoBtn.onclick = () => {
                                // Switch to company research tab
                                tabBtns.forEach(b => b.classList.remove('active'));
                                tabContents.forEach(c => c.classList.remove('active'));

                                const companyResearchTab = document.querySelector('[data-tab="company-research"]');
                                const companyResearchContent = document.getElementById('tab-company-research');

                                companyResearchTab.classList.add('active');
                                companyResearchContent.classList.add('active');
                            };
                        }
                    }, 100);

                    return;
                }
            }

            // Replace variables in the custom question/prompt
            // Check if the input contains variable placeholders
            const hasVariables = /{resume}|{job_title}|{company_name}|{job_description}|{company_research}|{company_description}/.test(customQuestionText);

            let customPrompt;
            if (hasVariables) {
                // User provided a prompt template with variables - replace them
                console.log('[Q&A] Custom prompt contains variables, replacing...');
                customPrompt = customQuestionText
                    .replace(/{resume}/g, RESUME_TEXT || '')
                    .replace(/{job_title}/g, currentJobTitle || 'this position')
                    .replace(/{company_name}/g, currentCompanyName || 'the company')
                    .replace(/{job_description}/g, currentJobText || '')
                    .replace(/{company_research}/g, currentCompanyResearch || '')
                    .replace(/{company_description}/g, currentCompanyResearch || '');

                console.log('[Q&A] Variables replaced. Prompt length:', customPrompt.length);
            } else {
                // User provided a simple question - create a structured prompt
                console.log('[Q&A] Custom question is a simple question, creating structured prompt...');
                customPrompt = `Based on the following resume and job description, answer this question: "${customQuestionText}"

RESUME:
${RESUME_TEXT}

JOB TITLE: ${currentJobTitle || 'this position'}
COMPANY: ${currentCompanyName || 'the company'}

JOB DESCRIPTION:
${currentJobText}

Provide a clear, concise, and professional answer.`;
            }

            let answer = '';

            if (aiProvider === 'copilot') {
                // Use GitHub Copilot
                copilotAuth.resetConversation();
                answer = await copilotAuth.chat(customPrompt, {
                    temperature: 0.7,
                    stream: false
                });
            } else {
                // Use OpenAI
                const apiUrl = API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
                const aiModel = AI_MODEL || 'gpt-4o-mini';

                const resp = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: aiModel,
                        messages: [
                            { role: 'user', content: customPrompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 500
                    })
                });

                if (!resp.ok) {
                    const errorData = await resp.json().catch(() => ({}));
                    throw new Error(errorData.error?.message || `HTTP ${resp.status}`);
                }

                const data = await resp.json();
                answer = data?.choices?.[0]?.message?.content?.trim() || '(empty response)';
            }

            // Display answer
            customAnswer.innerHTML = `
                <div style="border: 1px solid #e0e0e0; border-radius: 4px; padding: 12px; background: #f9f9f9;">
                    <div style="font-weight: 600; color: #0073b1; margin-bottom: 8px;">❓ ${customQuestionText}</div>
                    <div style="color: #333; line-height: 1.5; white-space: pre-wrap;">${answer}</div>
                </div>
            `;

        } catch (err) {
            console.error('Custom question error:', err);
            const errorMsg = err?.message || String(err);
            customAnswer.innerHTML = `<div style="color: #c62828;">Error: ${errorMsg}</div>`;
        } finally {
            askCustomQuestionBtn.disabled = false;
            askCustomQuestionBtn.textContent = '🤔 Get Answer';
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

    // Initialize: request job data from current tab with retry logic
    const initializeWithRetry = async (retryCount = 0, maxRetries = 3) => {
        console.log(`[Side Panel] Initialization attempt ${retryCount + 1}/${maxRetries + 1}`);
        setStatus('Initializing...');

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.url) {
                console.error('[Side Panel] No active tab found during initialization');
                if (retryCount < maxRetries) {
                    console.log('[Side Panel] Retrying in 1 second...');
                    setTimeout(() => initializeWithRetry(retryCount + 1, maxRetries), 1000);
                } else {
                    setError('No active tab found.');
                }
                return;
            }

            const url = new URL(tab.url);
            if (!url.hostname.includes('linkedin.com') || !url.pathname.startsWith('/jobs')) {
                console.warn('[Side Panel] Not a LinkedIn jobs page');
                setStatus('Please navigate to a LinkedIn job page.', true);
                return;
            }

            console.log('[Side Panel] Requesting job data from tab during initialization...');
            await requestJobDataFromTab();

        } catch (e) {
            console.error('[Side Panel] Error during initialization:', e);
            if (retryCount < maxRetries) {
                console.log('[Side Panel] Retrying in 1 second...');
                setTimeout(() => initializeWithRetry(retryCount + 1, maxRetries), 1000);
            } else {
                const errorMsg = e?.message || String(e);
                setError('Failed to initialize: ' + errorMsg);
            }
        }
    };

    // Start initialization with delay to allow content script to load
    setTimeout(() => initializeWithRetry(), 500);

    // Initialize cover letter button state
    updateCoverLetterButtonState();

})();

