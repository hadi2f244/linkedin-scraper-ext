// GitHub Copilot Authentication and Chat Module
// Converted from Python implementation to JavaScript

const COPILOT_CLIENT_ID = 'Iv1.b507a08c87ecfe98';
const COPILOT_MODEL = 'gpt-4o';

class CopilotAuth {
    constructor() {
        this.token = null;
        this.messages = [];
    }

    /**
     * Initiate GitHub device flow authentication
     * Returns device code, user code, and verification URI
     */
    async initiateDeviceFlow() {
        try {
            const response = await fetch('https://github.com/login/device/code', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'editor-version': 'Neovim/0.6.1',
                    'editor-plugin-version': 'copilot.vim/1.16.0',
                    'content-type': 'application/json',
                    'user-agent': 'GithubCopilot/1.155.0',
                    'accept-encoding': 'gzip,deflate,br'
                },
                body: JSON.stringify({
                    client_id: COPILOT_CLIENT_ID,
                    scope: 'read:user'
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to initiate device flow: ${response.status}`);
            }

            const data = await response.json();
            return {
                deviceCode: data.device_code,
                userCode: data.user_code,
                verificationUri: data.verification_uri,
                expiresIn: data.expires_in,
                interval: data.interval || 5
            };
        } catch (error) {
            console.error('Error initiating device flow:', error);
            throw error;
        }
    }

    /**
     * Poll for access token after user authorizes
     */
    async pollForAccessToken(deviceCode, interval = 5, maxAttempts = 60) {
        let attempts = 0;

        while (attempts < maxAttempts) {
            attempts++;

            // Wait before polling
            await new Promise(resolve => setTimeout(resolve, interval * 1000));

            try {
                const response = await fetch('https://github.com/login/oauth/access_token', {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'editor-version': 'Neovim/0.6.1',
                        'editor-plugin-version': 'copilot.vim/1.16.0',
                        'content-type': 'application/json',
                        'user-agent': 'GithubCopilot/1.155.0',
                        'accept-encoding': 'gzip,deflate,br'
                    },
                    body: JSON.stringify({
                        client_id: COPILOT_CLIENT_ID,
                        device_code: deviceCode,
                        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to poll for token: ${response.status}`);
                }

                const data = await response.json();

                // Check for errors
                if (data.error) {
                    if (data.error === 'authorization_pending') {
                        // User hasn't authorized yet, continue polling
                        continue;
                    } else if (data.error === 'slow_down') {
                        // Increase interval
                        interval += 5;
                        continue;
                    } else if (data.error === 'expired_token') {
                        throw new Error('Device code expired. Please try again.');
                    } else if (data.error === 'access_denied') {
                        throw new Error('Access denied by user.');
                    } else {
                        throw new Error(`OAuth error: ${data.error}`);
                    }
                }

                // Success - we have an access token
                if (data.access_token) {
                    return data.access_token;
                }

            } catch (error) {
                console.error('Error polling for token:', error);
                throw error;
            }
        }

        throw new Error('Timeout waiting for user authorization');
    }

    /**
     * Save access token to Chrome storage
     */
    async saveAccessToken(accessToken) {
        await chrome.storage.local.set({
            COPILOT_ACCESS_TOKEN: accessToken,
            COPILOT_TOKEN_DATE: new Date().toISOString()
        });
    }

    /**
     * Load access token from Chrome storage
     */
    async loadAccessToken() {
        const result = await chrome.storage.local.get(['COPILOT_ACCESS_TOKEN']);
        return result.COPILOT_ACCESS_TOKEN || null;
    }

    /**
     * Get Copilot session token using access token
     */
    async getCopilotToken(accessToken) {
        try {
            const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
                method: 'GET',
                headers: {
                    'authorization': `token ${accessToken}`,
                    'editor-version': 'Neovim/0.6.1',
                    'editor-plugin-version': 'copilot.vim/1.16.0',
                    'user-agent': 'GithubCopilot/1.155.0'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get Copilot token: ${response.status}`);
            }

            const data = await response.json();
            this.token = data.token;
            return data.token;
        } catch (error) {
            console.error('Error getting Copilot token:', error);
            throw error;
        }
    }

    /**
     * Ensure we have a valid Copilot token
     */
    async ensureToken() {
        if (this.token) {
            return this.token;
        }

        const accessToken = await this.loadAccessToken();
        if (!accessToken) {
            throw new Error('No access token found. Please authenticate first.');
        }

        return await this.getCopilotToken(accessToken);
    }

    /**
     * Send a chat message to Copilot
     */
    async chat(message, options = {}) {
        const token = await this.ensureToken();

        // Add user message to conversation
        this.messages.push({
            content: String(message),
            role: 'user'
        });

        try {
            const response = await fetch('https://api.githubcopilot.com/chat/completions', {
                method: 'POST',
                headers: {
                    'authorization': `Bearer ${token}`,
                    'Editor-Version': 'vscode/1.80.1',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    intent: false,
                    model: options.model || COPILOT_MODEL,
                    temperature: options.temperature || 0,
                    top_p: options.top_p || 1,
                    n: 1,
                    stream: options.stream !== false, // Default to streaming
                    messages: this.messages
                }),
                signal: options.signal // For abort controller
            });

            if (!response.ok) {
                throw new Error(`Copilot API error: ${response.status}`);
            }

            // Handle streaming response
            if (options.stream !== false) {
                return await this.handleStreamingResponse(response);
            } else {
                const data = await response.json();
                const content = data?.choices?.[0]?.message?.content?.trim() || '';
                this.messages.push({
                    content: content,
                    role: 'assistant'
                });
                return content;
            }

        } catch (error) {
            console.error('Error in Copilot chat:', error);
            throw error;
        }
    }

    /**
     * Handle streaming response from Copilot
     */
    async handleStreamingResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let result = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: {')) {
                        try {
                            const jsonData = JSON.parse(line.substring(6));
                            const content = jsonData?.choices?.[0]?.delta?.content;
                            if (content) {
                                result += content;
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }

            // Add assistant response to messages
            this.messages.push({
                content: result,
                role: 'assistant'
            });

            return result;

        } catch (error) {
            console.error('Error handling streaming response:', error);
            throw error;
        }
    }

    /**
     * Reset conversation history
     */
    resetConversation() {
        this.messages = [];
    }

    /**
     * Clear stored authentication
     */
    async clearAuth() {
        this.token = null;
        this.messages = [];
        await chrome.storage.local.remove(['COPILOT_ACCESS_TOKEN', 'COPILOT_TOKEN_DATE']);
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CopilotAuth;
}

