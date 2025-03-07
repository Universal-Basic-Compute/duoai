// Try to load required modules with error handling
let axios;
let fs;
let FormData;
let path;
let sharp; // Add sharp module

try {
    axios = require('axios');
    fs = require('fs');
    FormData = require('form-data');
    path = require('path');
    sharp = require('sharp'); // Import sharp module
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
    // Add fallback for sharp
    sharp = {
        resize: () => ({ jpeg: () => ({ toFile: () => Promise.resolve() }) })
    };
}

class ClaudeAPI {
    constructor() {
        // Try to get the port from localStorage, or default to 3000
        const serverPort = localStorage.getItem('serverPort') || 3000;
        this.apiUrl = `http://localhost:${serverPort}/api/claude`;
        this.base64ApiUrl = `http://localhost:${serverPort}/api/claude-base64`;
    }

    /**
     * Check if the backend server is running
     * @returns {Promise<boolean>} - True if server is running, false otherwise
     */
    async checkServerStatus() {
        try {
            // Try ports 3000, 3001, 3002
            for (let port = 3000; port <= 3002; port++) {
                try {
                    const response = await axios.get(`http://localhost:${port}/health`, { timeout: 1000 });
                    if (response.status === 200) {
                        // Found the correct port, update the API URLs
                        this.apiUrl = `http://localhost:${port}/api/claude`;
                        this.base64ApiUrl = `http://localhost:${port}/api/claude-base64`;
                        // Save the port for future use
                        localStorage.setItem('serverPort', port);
                        return true;
                    }
                } catch (portError) {
                    // This port didn't work, try the next one
                    continue;
                }
            }
            
            console.error('Could not find server on ports 3000-3002');
            return false;
        } catch (error) {
            console.error('Error checking server status:', error.message);
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
            
            // Further compress the image if it's too large (over 5MB)
            let base64Image;
            if (imageBuffer.length > 5 * 1024 * 1024) {
                console.log('Image is large, compressing further...');
                // Create a temporary file for the compressed image
                const tempPath = screenshotPath + '.compressed.jpg';
                
                // Compress the image
                await sharp(imageBuffer)
                    .resize({ width: 800 }) // Reduce width to 800px
                    .jpeg({ quality: 70 }) // Convert to JPEG with 70% quality
                    .toFile(tempPath);
                    
                // Read the compressed image
                const compressedBuffer = fs.readFileSync(tempPath);
                base64Image = compressedBuffer.toString('base64');
                
                // Delete the temporary file
                fs.unlinkSync(tempPath);
                
                console.log('Image compressed successfully');
            } else {
                // Convert to JPEG for better compression
                const tempPath = screenshotPath + '.jpg';
                
                // Convert to JPEG
                await sharp(imageBuffer)
                    .jpeg({ quality: 85 })
                    .toFile(tempPath);
                    
                // Read the JPEG image
                const jpegBuffer = fs.readFileSync(tempPath);
                base64Image = jpegBuffer.toString('base64');
                
                // Delete the temporary file
                fs.unlinkSync(tempPath);
                
                console.log('Image converted to JPEG');
            }
            
            console.log('Sending request to backend server...');
            console.log('Image size (base64):', Math.round(base64Image.length / 1024), 'KB');
            
            // Send the request to the backend server using the base64 endpoint
            const response = await axios.post(this.base64ApiUrl, {
                systemPrompt: systemPrompt || '',
                userMessage: userMessage || '',
                base64Image: base64Image
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 60000 // 60 second timeout
            });

            // Return Claude's response
            return response.data.response;
        } catch (error) {
            console.error('Error calling backend server:', error);
            if (error.response) {
                console.error('Response data:', error.response.data);
                console.error('Response status:', error.response.status);
            }
            throw new Error(`Failed to get response from Claude: ${error.message}`);
        }
    }
}

module.exports = new ClaudeAPI();
