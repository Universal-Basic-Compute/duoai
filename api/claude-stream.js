const axios = require('axios');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const airtableService = require('./airtable-service');

// Function to process adaptation
async function processAdaptation(username, characterName, conversationHistory) {
    try {
        console.log('[ADAPTATION] Processing adaptation for user:', username);
        
        // Skip if no conversation history
        if (!conversationHistory || conversationHistory.length < 2) {
            console.log('[ADAPTATION] Not enough conversation history to process adaptation');
            return null;
        }
        
        // Format the conversation history for the prompt
        const formattedConversation = conversationHistory.map(msg => {
            const role = msg.role === 'user' ? 'Player' : 'AI';
            return `${role}: ${msg.content[0].text}`;
        }).join('\n\n');
        
        // Read the adaptation prompt
        const rootDir = process.env.VERCEL ? process.cwd() : __dirname;
        const adaptationPromptPath = path.join(rootDir, 'prompts', 'adaptation.txt');
        
        let adaptationPrompt;
        try {
            adaptationPrompt = fs.readFileSync(adaptationPromptPath, 'utf8');
            console.log('[ADAPTATION] Read adaptation prompt successfully');
        } catch (error) {
            console.error('[ADAPTATION] Error reading adaptation prompt:', error);
            return null;
        }
        
        // Get the base prompt and character prompt for context
        const basePromptPath = path.join(rootDir, 'prompts', 'base_prompt.txt');
        const characterPromptPath = path.join(rootDir, 'prompts', 'characters', `${characterName.toLowerCase()}.txt`);
        
        let basePrompt = '';
        let characterPrompt = '';
        
        try {
            basePrompt = fs.readFileSync(basePromptPath, 'utf8');
            console.log('[ADAPTATION] Read base prompt successfully');
        } catch (error) {
            console.error('[ADAPTATION] Error reading base prompt:', error);
        }
        
        try {
            characterPrompt = fs.readFileSync(characterPromptPath, 'utf8');
            console.log(`[ADAPTATION] Read character prompt for ${characterName} successfully`);
        } catch (error) {
            console.error(`[ADAPTATION] Error reading character prompt for ${characterName}:`, error);
        }
        
        // Replace placeholders with actual content
        adaptationPrompt = adaptationPrompt.replace('{{conversation}}', formattedConversation);
        adaptationPrompt = adaptationPrompt.replace('{{base_prompt}}', basePrompt);
        adaptationPrompt = adaptationPrompt.replace('{{character_prompt}}', characterPrompt);
        
        // Call Claude API for adaptation analysis
        const payload = {
            model: 'claude-3-7-sonnet-latest',
            system: "You are an AI assistant that analyzes conversations and extracts insights in JSON format.",
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: adaptationPrompt
                        }
                    ]
                }
            ],
            max_tokens: 1000
        };
        
        console.log('[ADAPTATION] Sending adaptation request to Claude API');
        
        const response = await axios.post('https://api.anthropic.com/v1/messages', payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            }
        });
        
        // Extract the JSON response
        const adaptationText = response.data.content[0].text;
        console.log('[ADAPTATION] Received adaptation response:', adaptationText);
        
        // Parse the JSON
        let adaptationData;
        try {
            adaptationData = JSON.parse(adaptationText);
            console.log('[ADAPTATION] Successfully parsed adaptation JSON');
        } catch (parseError) {
            console.error('[ADAPTATION] Error parsing adaptation JSON:', parseError);
            console.error('[ADAPTATION] Raw response:', adaptationText);
            return null;
        }
        
        // Save the adaptation to Airtable
        await airtableService.saveAdaptation(username, characterName, adaptationData);
        
        return adaptationData;
    } catch (error) {
        console.error('[ADAPTATION] Error processing adaptation:', error);
        return null;
    }
}

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
        
        // Generate system prompt based on character and username
        const systemPrompt = await generateSystemPrompt(characterName, messageCount, username);
        console.log('[STREAM] Generated system prompt for character:', characterName, 'with message count:', messageCount);
        
        // Set up headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        
        // Extract username from request body or JWT token
        let username = req.body.username || 'anonymous'; // First try to get from request body

        // If not in request body, try to get from token
        if (username === 'anonymous') {
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
        }
    
        console.log('[STREAM] Final username for message:', username);
        
        // Use character name from request
        console.log('[STREAM] Character name from request:', characterName || 'None');
        
        // Fetch previous messages for context
        console.log('[STREAM] Fetching previous messages for context...');
        let previousMessages = [];
        let messageCount = 0;
        try {
            // Get previous messages from Airtable
            // First get all messages to count them
            const allMessages = await airtableService.getUserMessages(username, 100, characterName);
            
            // Set the message count for onboarding detection
            messageCount = allMessages ? allMessages.length : 0;
            console.log(`[STREAM] Total message count for this user and character: ${messageCount}`);
            
            // Now get a smaller set for context
            const messages = allMessages ? allMessages.slice(0, 10) : [];
            
            if (messages && messages.length > 0) {
                console.log(`[STREAM] Using ${messages.length} previous messages for context`);
                
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
                console.log('[STREAM] Username:', username);
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
            
            // Process adaptation asynchronously
            // This won't block the response to the client
            setTimeout(async () => {
                try {
                    console.log('[STREAM] Starting asynchronous adaptation processing');
                    
                    // Get the full conversation history for context
                    const conversationMessages = await airtableService.getUserMessages(username, 20, characterName);
                    
                    if (conversationMessages && conversationMessages.length > 0) {
                        // Convert to the format expected by the adaptation processor
                        const formattedMessages = conversationMessages
                            .sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp))
                            .map(msg => ({
                                role: msg.Role === 'user' ? 'user' : 'assistant',
                                content: [{ type: 'text', text: msg.Content }]
                            }));
                        
                        // Process the adaptation
                        await processAdaptation(username, characterName, formattedMessages);
                        console.log('[STREAM] Adaptation processing completed');
                    } else {
                        console.log('[STREAM] No conversation history found for adaptation processing');
                    }
                } catch (adaptationError) {
                    console.error('[STREAM] Error in asynchronous adaptation processing:', adaptationError);
                }
            }, 100); // Small delay to ensure response is sent first
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
async function generateSystemPrompt(characterName, messageCount = null, username = null) {
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
        
        // Combine base and character prompts
        let fullPrompt = `${basePrompt}\n\n${'='.repeat(50)}\n\n${characterPrompt}`;
        
        // Check if we have adaptations for this user and character
        if (username) {
            try {
                const adaptations = await airtableService.getUserAdaptations(username, characterName);
                
                if (adaptations && adaptations.length > 0) {
                    console.log(`[PROMPT] Found ${adaptations.length} adaptations for user ${username} and character ${characterName}`);
                    
                    // Get the most recent adaptation
                    const latestAdaptation = adaptations[0];
                    
                    // Add adaptation data to the prompt
                    fullPrompt += '\n\n' + '='.repeat(50) + '\n\n';
                    fullPrompt += 'PLAYER INSIGHTS:\n';
                    
                    if (latestAdaptation.CompanionCharacter) {
                        fullPrompt += `\nCompanion Character: ${latestAdaptation.CompanionCharacter}\n`;
                    }
                    
                    if (latestAdaptation.PlayerProfile) {
                        fullPrompt += `\nPlayer Profile: ${latestAdaptation.PlayerProfile}\n`;
                    }
                    
                    if (latestAdaptation.Memories) {
                        fullPrompt += `\nMemories: ${latestAdaptation.Memories}\n`;
                    }
                    
                    if (latestAdaptation.Requests) {
                        fullPrompt += `\nRequests: ${latestAdaptation.Requests}\n`;
                    }
                    
                    if (latestAdaptation.Ideas) {
                        fullPrompt += `\nIdeas for Interaction: ${latestAdaptation.Ideas}\n`;
                    }
                    
                    if (latestAdaptation.Notes) {
                        fullPrompt += `\nAdditional Notes: ${latestAdaptation.Notes}\n`;
                    }
                    
                    console.log('[PROMPT] Added adaptation data to system prompt');
                } else {
                    console.log(`[PROMPT] No adaptations found for user ${username} and character ${characterName}`);
                }
            } catch (adaptationError) {
                console.error('[PROMPT] Error getting adaptations:', adaptationError);
            }
        }
        
        // Check if we need to add the onboarding prompt based on message count
        if (messageCount !== null && messageCount < 20) {
            console.log('[PROMPT] Adding onboarding prompt due to low message count:', messageCount);
            
            // Onboarding prompt path
            const onboardingPromptPath = path.join(rootDir, 'prompts', 'onboarding.txt');
            
            // Read onboarding prompt
            let onboardingPrompt = '';
            try {
                onboardingPrompt = fs.readFileSync(onboardingPromptPath, 'utf8');
                console.log('[PROMPT] Read onboarding prompt successfully');
                
                // Add onboarding prompt to the full prompt
                fullPrompt += `\n\n${'='.repeat(50)}\n\nONBOARDING MODE:\n${onboardingPrompt}`;
            } catch (error) {
                console.error('[PROMPT] Error reading onboarding prompt:', error);
                // Continue without onboarding prompt if it can't be read
            }
        }
        
        console.log(`[PROMPT] Generated full prompt for ${characterName} (length: ${fullPrompt.length})`);
        
        return fullPrompt;
    } catch (error) {
        console.error('[PROMPT] Error generating system prompt:', error);
        return "You are DuoAI, an advanced gaming assistant with access to the player's screen.";
    }
}
