const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const airtableService = require('./airtable-service');
const rateLimiter = require('./rate-limiter');

module.exports = async (req, res) => {
  // Set CORS headers to allow requests from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
            console.log('Read base prompt successfully');
        } catch (error) {
            console.error('Error reading base prompt:', error);
            basePrompt = "You are DuoAI, an advanced gaming assistant with access to the player's screen.";
        }
        
        // If no character specified, return base prompt
        if (!characterName) {
            console.log('No character specified, using base prompt only');
            return basePrompt;
        }
        
        // Character-specific prompt path
        const characterPromptPath = path.join(rootDir, 'prompts', 'characters', `${characterName.toLowerCase()}.txt`);
        
        // Read character-specific prompt
        let characterPrompt = '';
        try {
            characterPrompt = fs.readFileSync(characterPromptPath, 'utf8');
            console.log(`Read character prompt for ${characterName} successfully`);
        } catch (error) {
            console.error(`Error reading character prompt for ${characterName}:`, error);
            return basePrompt; // Return base prompt if character prompt not found
        }
        
        // Combine prompts
        const fullPrompt = `${basePrompt}\n\n${'='.repeat(50)}\n\n${characterPrompt}`;
        console.log(`Generated full prompt for ${characterName} (length: ${fullPrompt.length})`);
        
        return fullPrompt;
    } catch (error) {
        console.error('Error generating system prompt:', error);
        return "You are DuoAI, an advanced gaming assistant with access to the player's screen.";
    }
}
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userMessage, base64Image, characterName } = req.body;

    if (!base64Image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Check if API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'API key configuration error' });
    }
    
    // Generate system prompt based on character
    const systemPrompt = await generateSystemPrompt(characterName);
    console.log('Generated system prompt for character:', characterName);
    
    // Process image with sharp in memory (no file system operations)
    const imageBuffer = Buffer.from(base64Image, 'base64');
    let processedBase64;
    
    // Compress the image if it's too large
    if (imageBuffer.length > 5 * 1024 * 1024) {
      const processedImageBuffer = await sharp(imageBuffer)
        .resize({ width: 800 })
        .jpeg({ quality: 70 })
        .toBuffer();
      
      processedBase64 = processedImageBuffer.toString('base64');
    } else {
      // Convert to JPEG for better compression
      const processedImageBuffer = await sharp(imageBuffer)
        .jpeg({ quality: 85 })
        .toBuffer();
      
      processedBase64 = processedImageBuffer.toString('base64');
    }
    
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
                
                console.log('Extracted username from token:', username);
            } else {
                console.log('No auth token, using anonymous username');
            }
        } catch (error) {
            console.error('Error extracting username from token:', error);
            console.log('Using anonymous username');
        }
    }
    
    console.log('Final username for message:', username);
    
    // Check rate limit
    const rateLimitResult = await rateLimiter.checkRateLimit(username);
    if (rateLimitResult.limited) {
        console.log(`Rate limit exceeded for user: ${username}`);
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'You have reached your message limit for this time period. Please upgrade your subscription at https://www.duogaming.ai/pricing.html to continue.',
            reset: rateLimitResult.reset,
            limit: rateLimitResult.limit
        });
    }
    
    // Extract character name from system prompt if available
    let characterName = null;
    if (systemPrompt) {
      const characterMatch = systemPrompt.match(/You are playing the role of (\w+)/i);
      if (characterMatch && characterMatch[1]) {
        characterName = characterMatch[1];
      }
    }
    
    // Fetch previous messages for context
    let previousMessages = [];
    try {
      console.log('Fetching previous messages for context...');
      const messages = await airtableService.getUserMessages(username, 20, characterName);
      
      if (messages && messages.length > 0) {
        console.log(`Found ${messages.length} previous messages`);
        
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
        console.log('No previous messages found');
      }
    } catch (fetchError) {
      console.error('Error fetching previous messages:', fetchError);
      // Continue without previous messages if there's an error
    }
    
    // Prepare the messages array for Claude API
    let claudeMessages = [...previousMessages];
    
    // Add the current message with the screenshot
    claudeMessages.push({
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: processedBase64
          }
        },
        {
          type: 'text',
          text: userMessage || `*${username} did not type a specific message at this time*`
        }
      ]
    });
    
    // Prepare the request payload for Claude API
    const payload = {
      model: 'claude-3-7-sonnet-latest',
      system: systemPrompt,
      messages: claudeMessages,
      max_tokens: 500
    };
    
    // Call Claude API
    const response = await axios.post('https://api.anthropic.com/v1/messages', payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });
    
    // Return Claude's response
    res.json({ response: response.data.content[0].text });
    
    // Save the user message and Claude's response to Airtable
    try {
        // Determine the context based on message count (if available)
        // Default to 'standard' if we don't have message count information
        const context = req.body.messageCount < 20 ? 'onboarding' : 'standard';
        
        // Save user message
        await airtableService.saveMessage(
            username,
            'user',
            userMessage || `*${username} did not type a specific message at this time*`,
            characterName,
            context // Add context parameter
        );
        
        // Save assistant message
        await airtableService.saveMessage(
            username,
            'assistant',
            response.data.content[0].text,
            characterName,
            context // Add context parameter
        );
        
        console.log('Messages saved to Airtable');
    } catch (saveError) {
        console.error('Error saving messages to Airtable:', saveError);
        // Don't fail the request if saving messages fails
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Error processing request',
      details: error.response ? error.response.data : error.message
    });
  }
};
