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
        // Use relative URLs for serverless endpoints
        this.apiUrl = '/api/claude';
        this.base64ApiUrl = '/api/claude-base64';
    }

    /**
     * Check if the backend server is running
     * @returns {Promise<boolean>} - True if server is running, false otherwise
     */
    async checkServerStatus() {
        try {
            // Try the serverless health endpoint
            const response = await axios.get('/health', { timeout: 5000 });
            if (response.status === 200) {
                // Server is running
                this.apiUrl = '/api/claude';
                this.base64ApiUrl = '/api/claude-base64';
                return true;
            }
            
            console.error('Serverless API health check failed');
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
     * @throws {Error} - If the API call fails or the screenshot is invalid
     */
    async sendMessageWithScreenshot(systemPrompt, userMessage, screenshotPath) {
        try {
            // Check if server is running
            const serverRunning = await this.checkServerStatus().catch(() => false);
            if (!serverRunning) {
                throw new Error('Remote server is not available. Please check your internet connection.');
            }

            // Check if screenshot file exists
            if (!fs.existsSync(screenshotPath)) {
                throw new Error(`Screenshot file not found at path: ${screenshotPath}`);
            }

            console.log('Reading screenshot file:', screenshotPath);
            
            // Read the file as buffer
            const imageBuffer = fs.readFileSync(screenshotPath);
            
            // Optimize the screenshot
            const base64Image = await this.optimizeScreenshot(imageBuffer);
            
            console.log('Sending request to remote server...');
            console.log('Image size (base64):', Math.round(base64Image.length / 1024), 'KB');
            
            // Add error handling with retries
            let retries = 0;
            const maxRetries = 2;
            
            while (retries <= maxRetries) {
                try {
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
                } catch (requestError) {
                    retries++;
                    
                    // If we've reached max retries, throw the error
                    if (retries > maxRetries) {
                        throw requestError;
                    }
                    
                    console.log(`Request failed, retrying (${retries}/${maxRetries})...`);
                    
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                }
            }
        } catch (error) {
            console.error('Error calling remote server:', error);
            if (error.response) {
                console.error('Response data:', error.response.data);
                console.error('Response status:', error.response.status);
            }
            throw new Error(`Failed to get response from Claude: ${error.message}`);
        }
    }
    /**
     * Optimize a screenshot for sending to Claude API
     * @param {Buffer} imageBuffer - The image buffer
     * @returns {Promise<string>} - Base64 encoded optimized image
     */
    async optimizeScreenshot(imageBuffer) {
        try {
            // Get image metadata
            const metadata = await sharp(imageBuffer).metadata();
            
            let processedBuffer;
            
            // Determine if we need to resize based on dimensions and size
            if (metadata.width > 1200 || metadata.height > 1200 || imageBuffer.length > 5 * 1024 * 1024) {
                console.log('Image is large, optimizing...');
                // Resize and compress
                processedBuffer = await sharp(imageBuffer)
                    .resize({ 
                        width: Math.min(1200, metadata.width),
                        height: Math.min(1200, metadata.height),
                        fit: 'inside'
                    })
                    .jpeg({ quality: 75 })
                    .toBuffer();
                
                console.log('Image optimized successfully');
            } else {
                // Just convert to JPEG for better compression
                processedBuffer = await sharp(imageBuffer)
                    .jpeg({ quality: 85 })
                    .toBuffer();
                
                console.log('Image converted to JPEG');
            }
            
            // Convert to base64
            return processedBuffer.toString('base64');
        } catch (error) {
            console.error('Error optimizing screenshot:', error);
            // Fallback to original image if optimization fails
            return imageBuffer.toString('base64');
        }
    }
    
    /**
     * Send a message to Claude with a screenshot via the backend server with streaming response
     * @param {string} userMessage - The user's message
     * @param {string} screenshotPath - Path to the screenshot file
     * @param {string} characterName - The character name
     * @param {Function} onChunk - Callback function for each text chunk
     * @param {Function} onComplete - Callback function when streaming is complete
     * @returns {Promise<void>} - Resolves when streaming is complete
     * @throws {Error} - If the API call fails or the screenshot is invalid
     */
    async sendMessageWithScreenshotStreaming(userMessage, screenshotPath, characterName, onChunk, onComplete) {
        try {
            // Check if server is running
            const serverRunning = await this.checkServerStatus().catch(() => false);
            if (!serverRunning) {
                throw new Error('Remote server is not available. Please check your internet connection.');
            }

            // Check if screenshot file exists
            if (!fs.existsSync(screenshotPath)) {
                throw new Error(`Screenshot file not found at path: ${screenshotPath}`);
            }

            console.log('Reading screenshot file:', screenshotPath);
            
            // Read the file as buffer
            const imageBuffer = fs.readFileSync(screenshotPath);
            
            // Optimize the screenshot
            const base64Image = await this.optimizeScreenshot(imageBuffer);
            
            console.log('Sending streaming request to remote server...');
            console.log('Image size (base64):', Math.round(base64Image.length / 1024), 'KB');
            
            // Add error handling with retries
            let retries = 0;
            const maxRetries = 2;
            
            while (retries <= maxRetries) {
                try {
                    // Use relative URL for the streaming endpoint
                    const streamUrl = '/api/claude-stream';
                    console.log('Using stream URL:', streamUrl);
                    
                    // Send the request to the backend server using the streaming endpoint
                    // Note: We no longer send systemPrompt, only characterName
                    const response = await axios.post(streamUrl, {
                        userMessage: userMessage || '',
                        base64Image: base64Image,
                        characterName: characterName || ''
                    }, {
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity,
                        timeout: 120000, // 2 minute timeout
                        // Use 'text' instead of 'stream' for browser compatibility
                        responseType: 'text'
                    });

                    // Process the response text as SSE
                    if (response.data) {
                        let fullResponse = '';
                        // Split by event boundaries, not just newlines
                        const events = response.data.split('\n\n');
                        
                        for (const event of events) {
                            if (!event.trim()) continue;
                            
                            // Extract the data part more precisely
                            const match = event.match(/^data: (.+)$/m);
                            if (!match) continue;
                            
                            try {
                                const data = JSON.parse(match[1]);
                                
                                // Handle different event types
                                if (data.type === 'content_block_delta' && 
                                    data.delta && 
                                    data.delta.type === 'text_delta') {
                                    
                                    const textChunk = data.delta.text;
                                    fullResponse += textChunk;
                                    
                                    // Call the callback with the text chunk
                                    if (onChunk) onChunk(textChunk);
                                }
                            } catch (parseError) {
                                console.warn('Error parsing SSE data:', parseError);
                            }
                        }
                        
                        // Call the complete callback
                        if (onComplete) onComplete(fullResponse);
                        return fullResponse;
                    }
                    
                    return '';
                } catch (requestError) {
                    retries++;
                    
                    // If we've reached max retries, throw the error
                    if (retries > maxRetries) {
                        throw requestError;
                    }
                    
                    console.log(`Request failed, retrying (${retries}/${maxRetries})...`);
                    
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                }
            }
        } catch (error) {
            console.error('Error calling remote server:', error);
            if (error.response) {
                console.error('Response data:', error.response.data);
                console.error('Response status:', error.response.status);
            }
            throw new Error(`Failed to get response from Claude: ${error.message}`);
        }
    }
}

module.exports = new ClaudeAPI();
