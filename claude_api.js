// Try to load required modules with error handling
let axios;
let fs;
let FormData;
let path;

try {
    axios = require('axios');
    fs = require('fs');
    FormData = require('form-data');
    path = require('path');
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
        try {
            // Check if server is running
            const serverRunning = await this.checkServerStatus().catch(() => false);
            if (!serverRunning) {
                throw new Error('Backend server is not running. Please start the server first.');
            }

            // Check if screenshot file exists
            if (!fs.existsSync(screenshotPath)) {
                throw new Error(`Screenshot file not found at path: ${screenshotPath}`);
            }

            console.log('Reading screenshot file:', screenshotPath);
            
            // Read the file as base64
            const imageBuffer = fs.readFileSync(screenshotPath);
            const base64Image = imageBuffer.toString('base64');
            
            console.log('Sending request to backend server...');
            
            // Send the request to the backend server using the base64 endpoint
            const response = await axios.post('http://localhost:3000/api/claude-base64', {
                systemPrompt: systemPrompt || '',
                userMessage: userMessage || '',
                base64Image: base64Image
            }, {
                headers: {
                    'Content-Type': 'application/json'
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
