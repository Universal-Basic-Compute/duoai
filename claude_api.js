// Try to load required modules with error handling
let axios;
let fs;
let FormData;

try {
    axios = require('axios');
    fs = require('fs');
    FormData = require('form-data');
} catch (error) {
    console.error('Error loading modules:', error);
    // Provide fallback implementations to prevent further errors
    axios = {
        post: () => Promise.reject(new Error('axios module not available'))
    };
    fs = {
        createReadStream: () => null
    };
    FormData = function() {
        return {
            append: () => {},
            getHeaders: () => ({})
        };
    };
}

class ClaudeAPI {
    constructor() {
        this.apiUrl = 'http://localhost:3000/api/claude'; // Your backend server URL
    }

    /**
     * Check if the backend server is running
     * @returns {Promise<boolean>} - True if server is running, false otherwise
     */
    async checkServerStatus() {
        try {
            // Simple GET request to check if server is running
            await axios.get('http://localhost:3000/health');
            return true;
        } catch (error) {
            console.error('Backend server is not running:', error.message);
            return false;
        }
    }

    /**
     * Send a message to Claude with a screenshot via the backend server
     * @param {string} systemPrompt - The system prompt
     * @param {string} userMessage - The user's message
     * @param {string} screenshotPath - Path to the screenshot file
     * @returns {Promise<string>} - Claude's response
     */
    async sendMessageWithScreenshot(systemPrompt, userMessage, screenshotPath) {
        // Check if server is running
        const serverRunning = await this.checkServerStatus().catch(() => false);
        if (!serverRunning) {
            throw new Error('Backend server is not running. Please start the server first.');
        }
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
