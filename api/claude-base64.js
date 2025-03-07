const axios = require('axios');
const sharp = require('sharp');
const airtableService = require('../../airtable-service');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { systemPrompt, userMessage, base64Image } = req.body;

    if (!base64Image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Check if API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'API key configuration error' });
    }
    
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
    
    // Use a mock user ID if req.user is not available
    const userId = req.user ? req.user.id : 'mock-user-id';
    
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
      const messages = await airtableService.getUserMessages(userId, 20);
      
      if (messages && messages.length > 0) {
        console.log(`Found ${messages.length} previous messages`);
        
        // Convert Airtable messages to Claude message format
        // Sort by timestamp ascending (oldest first)
        previousMessages = messages
          .sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp))
          .map(msg => ({
            role: msg.Role === 'user' ? 'user' : 'assistant',
            content: msg.Role === 'user' 
              ? msg.Content 
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
          text: userMessage || "*the user did not type a specific message at this time*"
        }
      ]
    });
    
    // Prepare the request payload for Claude API
    const payload = {
      model: 'claude-3-7-sonnet-latest',
      system: systemPrompt || '',
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
        if (req.user && req.user.id) {
            // Extract character name from system prompt if available
            let characterName = null;
            if (systemPrompt) {
                const characterMatch = systemPrompt.match(/You are playing the role of (\w+)/i);
                if (characterMatch && characterMatch[1]) {
                    characterName = characterMatch[1];
                }
            }
            
            // Save user message
            await airtableService.saveMessage(
                req.user.id,
                'user',
                userMessage || "*the user did not type a specific message at this time*",
                characterName
            );
            
            // Save assistant message
            await airtableService.saveMessage(
                req.user.id,
                'assistant',
                response.data.content[0].text,
                characterName
            );
            
            console.log('Messages saved to Airtable');
        }
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
