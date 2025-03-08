const axios = require('axios');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const airtableService = require('./airtable-service');

module.exports = async (req, res) => {
    try {
        // Set CORS headers to allow requests from any origin
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        
        console.log('[STREAM] Received request to /api/claude-stream');
        
        const { userMessage, base64Image, characterName } = req.body;
        let fullResponse = '';

        if (!base64Image) {
            console.error('[STREAM] No base64 image in request');
            return res.status(400).json({ error: 'No image provided' });
        }

        // Check if API key is available
        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('[STREAM] Anthropic API key is missing');
            return res.status(500).json({ error: 'API key configuration error' });
        }

        console.log('[STREAM] Preparing streaming request to Claude API');
        console.log('[STREAM] Character name:', characterName || 'None');
        console.log('[STREAM] User message:', userMessage);
        
        // Generate system prompt based on character
        const systemPrompt = await generateSystemPrompt(characterName);
        console.log('[STREAM] Generated system prompt for character:', characterName);
        
        // Set up headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        
        // Extract username from JWT token if available
        let username = 'anonymous';
        try {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'duoai-jwt-secret');
                
                // Get user email from token
                const userEmail = decoded.email;
                
                // Get the user from Airtable to get the username
                const user = await airtableService.findUserByEmail(userEmail);
                username = user ? user.Username : userEmail;
                
                console.log('[STREAM] Extracted username from token:', username);
            } else {
                console.log('[STREAM] No auth token, using anonymous username');
            }
        } catch (error) {
            console.error('[STREAM] Error extracting username from token:', error);
            console.log('[STREAM] Using anonymous username');
        }
        
        // Use character name from request
        console.log('[STREAM] Character name from request:', characterName || 'None');
        
        // Fetch previous messages for context
        console.log('[STREAM] Fetching previous messages for context...');
        let previousMessages = [];
        try {
            // Get previous messages from Airtable (limit to 10 for context)
            const messages = await airtableService.getUserMessages(userId, 10);
            
            if (messages && messages.length > 0) {
                console.log(`[STREAM] Found ${messages.length} previous messages for context`);
                
                // Convert Airtable messages to Claude message format
                // Sort by timestamp ascending (oldest first)
                previousMessages = messages
                    .sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp))
                    .map(msg => ({
                        role: msg.Role === 'user' ? 'user' : 'assistant',
                        content: msg.Role === 'user' 
                            ? [{ type: 'text', text: msg.Content }]
                            : [{ type: 'text', text: msg.Content }]
                    }));
            } else {
                console.log('[STREAM] No previous messages found for context');
            }
        } catch (historyError) {
            console.error('[STREAM] Error fetching message history:', historyError);
            // Continue without history if there's an error
        }
        
        // Save user message to Airtable immediately
        try {
            console.log('[STREAM] Saving user message to Airtable...');
            
            const savedUserMessage = await airtableService.saveMessage(
                username,
                'user',
                userMessage || `*${username} did not type a specific message at this time*`,
                characterName
            );
            
            if (savedUserMessage) {
                console.log('[STREAM] User message saved to Airtable successfully with ID:', savedUserMessage.id);
            } else {
                console.error('[STREAM] Failed to save user message to Airtable - returned null');
            }
        } catch (saveError) {
            console.error('[STREAM] Error saving user message to Airtable:', saveError);
            console.error('[STREAM] Error message:', saveError.message);
            console.error('[STREAM] Error stack:', saveError.stack);
            // Don't fail the request if saving messages fails
        }
        
        // Prepare the request payload for Claude API with streaming
        const payload = {
            model: 'claude-3-7-sonnet-latest',
            system: systemPrompt,
            messages: [
                // Include previous messages for context
                ...previousMessages,
                // Add the current message with screenshot
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
                            text: userMessage || "*the user did not type a specific message at this time*"
                        }
                    ]
                }
            ],
            max_tokens: 500,
            stream: true
        };

        console.log('[STREAM] Sending streaming request to Claude API');
        
        // Call Claude API with streaming
        const response = await axios.post('https://api.anthropic.com/v1/messages', payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            responseType: 'stream'
        });
        
        console.log('[STREAM] Received streaming response from Claude API');
        
        // Process the stream
        response.data.on('data', (chunk) => {
            const text = chunk.toString();
            res.write(text);
            
            // Try to extract content from the chunk
            try {
                const lines = text.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const data = JSON.parse(line.substring(5).trim());
                        if (data.type === 'content_block_delta' && 
                            data.delta && 
                            data.delta.type === 'text_delta') {
                            fullResponse += data.delta.text;
                        }
                    }
                }
            } catch (e) {
                // Ignore parsing errors in chunks
            }
        });
        
        // Handle end of stream
        response.data.on('end', async () => {
            console.log('[STREAM] Stream ended, full response length:', fullResponse.length);
            
            // Save assistant message to Airtable
            try {
                console.log('[STREAM] Saving assistant message to Airtable...');
                console.log('[STREAM] User ID:', userId);
                console.log('[STREAM] Character:', characterName || 'None');
                console.log('[STREAM] Message length:', fullResponse.length);
                
                if (fullResponse.length > 0) {
                    const savedAssistantMessage = await airtableService.saveMessage(
                        username,
                        'assistant',
                        fullResponse,
                        characterName
                    );
                    
                    if (savedAssistantMessage) {
                        console.log('[STREAM] Assistant message saved to Airtable successfully with ID:', savedAssistantMessage.id);
                    } else {
                        console.error('[STREAM] Failed to save assistant message to Airtable - returned null');
                    }
                } else {
                    console.error('[STREAM] No response text to save to Airtable');
                }
            } catch (saveError) {
                console.error('[STREAM] Error saving assistant message to Airtable:', saveError);
                console.error('[STREAM] Error message:', saveError.message);
                console.error('[STREAM] Error stack:', saveError.stack);
            }
            
            // End the response
            res.write('event: message_stop\ndata: {"type": "message_stop"}\n\n');
            res.end();
            console.log('[STREAM] Response ended');
        });
        
        // Handle errors in the stream
        response.data.on('error', (error) => {
            console.error('[STREAM] Stream error:', error);
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        });
    } catch (error) {
        console.error('[STREAM] Error calling Claude API streaming:', error.message);
        console.error('[STREAM] Error stack:', error.stack);
        
        // Try to send an error response if possible
        try {
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: 'Error processing streaming request',
                    details: error.response ? error.response.data : error.message
                });
            } else {
                res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
                res.end();
            }
        } catch (responseError) {
            console.error('[STREAM] Error sending error response:', responseError);
        }
    }
};

// Function to generate system prompts based on character
async function generateSystemPrompt(characterName) {
    try {
        // Base prompt path - use process.cwd() for Vercel
        const rootDir = process.env.VERCEL ? process.cwd() : __dirname;
        const basePromptPath = path.join(rootDir, 'prompts', 'base_prompt.txt');
        
        // Read base prompt
        let basePrompt = '';
        try {
            basePrompt = fs.readFileSync(basePromptPath, 'utf8');
            console.log('[PROMPT] Read base prompt successfully');
        } catch (error) {
            console.error('[PROMPT] Error reading base prompt:', error);
            basePrompt = "You are DuoAI, an advanced gaming assistant with access to the player's screen.";
        }
        
        // If no character specified, return base prompt
        if (!characterName) {
            console.log('[PROMPT] No character specified, using base prompt only');
            return basePrompt;
        }
        
        // Character-specific prompt path
        const characterPromptPath = path.join(rootDir, 'prompts', 'characters', `${characterName.toLowerCase()}.txt`);
        
        // Read character-specific prompt
        let characterPrompt = '';
        try {
            characterPrompt = fs.readFileSync(characterPromptPath, 'utf8');
            console.log(`[PROMPT] Read character prompt for ${characterName} successfully`);
        } catch (error) {
            console.error(`[PROMPT] Error reading character prompt for ${characterName}:`, error);
            return basePrompt; // Return base prompt if character prompt not found
        }
        
        // Combine prompts
        const fullPrompt = `${basePrompt}\n\n${'='.repeat(50)}\n\n${characterPrompt}`;
        console.log(`[PROMPT] Generated full prompt for ${characterName} (length: ${fullPrompt.length})`);
        
        return fullPrompt;
    } catch (error) {
        console.error('[PROMPT] Error generating system prompt:', error);
        return "You are DuoAI, an advanced gaming assistant with access to the player's screen.";
    }
}
