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
    console.log('All required modules loaded successfully');
} catch (error) {
    console.error('Error loading modules:', error);
    // Provide fallback implementations to prevent further errors
    axios = {
        post: () => Promise.reject(new Error('axios module not available')),
        get: () => Promise.reject(new Error('axios module not available'))
    };
    fs = {
        createReadStream: () => null,
        existsSync: () => false,
        readFileSync: () => Buffer.from([])
    };
    FormData = function() {
        return {
            append: () => {},
            getHeaders: () => ({})
        };
    };
    // Add fallback for sharp
    sharp = function() {
        return {
            resize: () => ({ jpeg: () => ({ toBuffer: () => Promise.resolve(Buffer.from([])) }) })
        };
    };
}

// Load config to get API URL
const { loadConfig } = require('./config');

class ClaudeAPI {
    constructor() {
        // Always use the production URL
        this.baseUrl = 'https://duoai.vercel.app';
        console.log(`Using API base URL: ${this.baseUrl}`);
        
        // Use URLs with base URL for serverless endpoints
        this.apiUrl = `${this.baseUrl}/api/claude`;
        this.base64ApiUrl = `${this.baseUrl}/api/claude-base64`;
    }

    /**
     * Check if the backend server is running
     * @returns {Promise<boolean>} - True if server is running, false otherwise
     */
    async checkServerStatus() {
        try {
            console.log(`Checking server status at ${this.baseUrl}/api/health`);
            // Try the serverless health endpoint with base URL
            const response = await axios.get(`${this.baseUrl}/api/health`, { 
                timeout: 5000,
                headers: {
                    'Accept': 'application/json'
                }
            });
            console.log('Health check response:', response.status, response.data);
            if (response.status === 200) {
                // Server is running
                this.apiUrl = `${this.baseUrl}/api/claude`;
                this.base64ApiUrl = `${this.baseUrl}/api/claude-base64`;
                return true;
            }
            
            console.error('Serverless API health check failed');
            return false;
        } catch (error) {
            console.error('Error checking server status:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
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
     * @param {string} authToken - Authentication token
     * @returns {Promise<void>} - Resolves when streaming is complete
     * @throws {Error} - If the API call fails or the screenshot is invalid
     */
    async sendMessageWithScreenshotStreaming(userMessage, screenshotPath, characterName, onChunk, onComplete, authToken) {
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
                    // Use the base URL for the streaming endpoint
                    const streamUrl = `${this.baseUrl}/api/claude-stream`;
                    console.log('Using stream URL:', streamUrl);
                
                    // Prepare headers with authentication token if provided
                    const headers = {
                        'Content-Type': 'application/json'
                    };
                
                    if (authToken) {
                        headers['Authorization'] = `Bearer ${authToken}`;
                    }
                
                    // Get username from localStorage if available
                    let username = 'anonymous';
                    try {
                        const userJson = localStorage.getItem('user');
                        if (userJson) {
                            const user = JSON.parse(userJson);
                            username = user.name || 'anonymous';
                            console.log('Using username from localStorage:', username);
                        }
                    } catch (e) {
                        console.error('Error getting username from localStorage:', e);
                    }
                
                    // Format the user message based on whether it's empty or not and message count
                    let formattedUserMessage;
                    
                    // Special case for proactive messages
                    if (userMessage === '*proactive message*') {
                        formattedUserMessage = `You are playing with ${username}. Here is ${username}'s current screen. The user hasn't interacted in a while. Proactively comment on something interesting you notice on their screen or ask a question about what they might be doing. Be brief (1-2 sentences) and conversational. Your response:`;
                    } else if (messageCount < 20) {
                        // Onboarding mode - explicitly instruct Claude to ask questions
                        if (userMessage && userMessage.trim()) {
                            // Normal user message in onboarding mode
                            formattedUserMessage = `You are in ONBOARDING MODE with ${username}. Here is ${username}'s current screen. Don't describe it, but focus on getting to know the player through engaging questions.\n\n${userMessage}\n\nRespond briefly (1-2 sentences) and end with a question to keep the conversation going. Your response:`;
                        } else {
                            // Default message when user didn't type anything in onboarding mode
                            formattedUserMessage = `You are in ONBOARDING MODE with ${username}. Here is ${username}'s current screen. Don't describe it, but focus on getting to know the player through engaging questions.\n\n*${username} did not type a specific message at this time*\n\nIntroduce yourself briefly (1-2 sentences) and ask an engaging question to start the conversation. Your response:`;
                        }
                    } else {
                        // Standard mode - continue as before
                        if (userMessage && userMessage.trim()) {
                            // Normal user message
                            formattedUserMessage = `You are playing with ${username}. Here is ${username}'s current screen. Don't describe it, but continue the conversation naturally as a gaming partner.\n\n${userMessage}\n\nAnswer in 1-2 short sentences. Your answer:`;
                        } else {
                            // Default message when user didn't type anything
                            formattedUserMessage = `You are playing with ${username}. Here is ${username}'s current screen. Don't describe it, but continue the conversation naturally as a gaming partner.\n\n*${username} did not type a specific message at this time*\n\nSay whatever you feel like, in 1-2 short sentences. Your answer:`;
                        }
                    }

                    // Send the request to the backend server using the streaming endpoint
                    const response = await axios.post(streamUrl, {
                        userMessage: formattedUserMessage,
                        base64Image: base64Image,
                        characterName: characterName || '',
                        username: username // Add username to the request body
                    }, {
                        headers: headers,
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
