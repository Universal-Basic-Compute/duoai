const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ClaudeAPI {
    constructor() {
        // Load API key from environment variable or config file
        this.apiKey = process.env.CLAUDE_API_KEY || '';
        this.apiUrl = 'https://api.anthropic.com/v1/messages';
        this.model = 'claude-3-sonnet-20240229';
    }

    /**
     * Set the API key
     * @param {string} apiKey - Claude API key
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Send a message to Claude with a screenshot
     * @param {string} systemPrompt - The system prompt
     * @param {string} userMessage - The user's message
     * @param {string} screenshotPath - Path to the screenshot file
     * @returns {Promise<string>} - Claude's response
     */
    async sendMessageWithScreenshot(systemPrompt, userMessage, screenshotPath) {
        if (!this.apiKey) {
            throw new Error('Claude API key is not set');
        }

        try {
            // Read the screenshot file and convert to base64
            const imageBuffer = fs.readFileSync(screenshotPath);
            const base64Image = imageBuffer.toString('base64');
            const mimeType = 'image/png';
            const dataUri = `data:${mimeType};base64,${base64Image}`;

            // Prepare the request payload
            const payload = {
                model: this.model,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mimeType,
                                    data: base64Image
                                }
                            },
                            {
                                type: 'text',
                                text: userMessage || "What do you see in this screenshot? Can you provide any gaming advice based on what you see?"
                            }
                        ]
                    }
                ],
                max_tokens: 4000
            };

            // Send the request to Claude API
            const response = await axios.post(this.apiUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            });

            // Return Claude's response
            return response.data.content[0].text;
        } catch (error) {
            console.error('Error calling Claude API:', error);
            if (error.response) {
                console.error('Response data:', error.response.data);
                console.error('Response status:', error.response.status);
            }
            throw error;
        }
    }
}

module.exports = new ClaudeAPI();
