const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

class ClaudeAPI {
    constructor() {
        this.apiUrl = 'http://localhost:3000/api/claude'; // Your backend server URL
    }

    /**
     * Send a message to Claude with a screenshot via the backend server
     * @param {string} systemPrompt - The system prompt
     * @param {string} userMessage - The user's message
     * @param {string} screenshotPath - Path to the screenshot file
     * @returns {Promise<string>} - Claude's response
     */
    async sendMessageWithScreenshot(systemPrompt, userMessage, screenshotPath) {
        try {
            // Create a FormData object
            const formData = new FormData();
            formData.append('systemPrompt', systemPrompt || '');
            formData.append('userMessage', userMessage || '');
            formData.append('screenshot', fs.createReadStream(screenshotPath));

            // Send the request to the backend server
            const response = await axios.post(this.apiUrl, formData, {
                headers: {
                    ...formData.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            // Return Claude's response
            return response.data.response;
        } catch (error) {
            console.error('Error calling backend server:', error);
            if (error.response) {
                console.error('Response data:', error.response.data);
                console.error('Response status:', error.response.status);
            }
            throw error;
        }
    }
}

module.exports = new ClaudeAPI();
