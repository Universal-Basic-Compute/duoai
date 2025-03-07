const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const FormData = require('form-data');

// Configure multer for memory storage (no file system operations)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// For Vercel, we need to use a different approach since we can't use Express middleware directly
module.exports = async (req, res) => {
    try {
        console.log('Received request to /api/claude');
        
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }
        
        const { systemPrompt, userMessage, base64Image } = req.body;

        if (!base64Image) {
            console.error('No base64 image in request');
            return res.status(400).json({ error: 'No image provided' });
        }

        // Check if API key is available
        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('Anthropic API key is missing');
            return res.status(500).json({ error: 'API key configuration error' });
        }

        console.log('Preparing request to Claude API');
        console.log('System prompt length:', systemPrompt ? systemPrompt.length : 0);
        console.log('User message:', userMessage);
        
        // Prepare the request payload for Claude API
        const payload = {
            model: 'claude-3-7-sonnet-latest',
            system: systemPrompt || '',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: 'image/jpeg',
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
            max_tokens: 500
        };

        console.log('Sending request to Claude API');
        
        // Call Claude API
        try {
            const response = await axios.post('https://api.anthropic.com/v1/messages', payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                }
            });
            
            console.log('Received response from Claude API');
            
            // Return Claude's response
            res.json({ response: response.data.content[0].text });
        } catch (apiError) {
            console.error('Error from Claude API:', apiError.message);
            if (apiError.response) {
                console.error('Claude API response status:', apiError.response.status);
                console.error('Claude API response data:', JSON.stringify(apiError.response.data, null, 2));
            }
            throw apiError;
        }
    } catch (error) {
        console.error('Error calling Claude API:', error.message);
        res.status(500).json({ 
            error: 'Error processing request',
            details: error.response ? error.response.data : error.message
        });
    }
};
