const axios = require('axios');
const sharp = require('sharp');
const airtableService = require('../../airtable-service');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { systemPrompt, userMessage, base64Image } = req.body;
    let fullResponse = '';

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
    
    // Save user message to Airtable immediately
    try {
      console.log('Saving user message to Airtable...');
      console.log('User ID:', userId);
      console.log('Character:', characterName || 'None');
      
      await airtableService.saveMessage(
        userId,
        'user',
        userMessage || "*the user did not type a specific message at this time*",
        characterName
      );
      
      console.log('User message saved to Airtable successfully');
    } catch (saveError) {
      console.error('Error saving user message to Airtable:', saveError);
      // Don't fail the request if saving messages fails
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
    
    // Prepare the request payload for Claude API with streaming enabled
    const payload = {
      model: 'claude-3-7-sonnet-latest',
      system: systemPrompt || '',
      messages: claudeMessages,
      max_tokens: 500,
      stream: true // Enable streaming
    };
    
    // Set up headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    console.log('Sending streaming request to Claude API with model:', payload.model);
    
    // Call Claude API with streaming
    const response = await axios.post('https://api.anthropic.com/v1/messages', payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      responseType: 'stream'
    });
    
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
      console.log('Stream ended, full response length:', fullResponse.length);
      
      // Save assistant message to Airtable
      try {
        // Extract character name from system prompt if available
        let characterName = null;
        if (systemPrompt) {
          const characterMatch = systemPrompt.match(/You are playing the role of (\w+)/i);
          if (characterMatch && characterMatch[1]) {
            characterName = characterMatch[1];
          }
        }
        
        // Use a mock user ID if req.user is not available
        const userId = req.user ? req.user.id : 'mock-user-id';
        
        console.log('Saving assistant message to Airtable...');
        console.log('User ID:', userId);
        console.log('Character:', characterName || 'None');
        console.log('Message length:', fullResponse.length);
        
        if (fullResponse.length > 0) {
          await airtableService.saveMessage(
            userId,
            'assistant',
            fullResponse,
            characterName
          );
          
          console.log('Assistant message saved to Airtable successfully');
        } else {
          console.error('No response text to save to Airtable');
        }
      } catch (saveError) {
        console.error('Error saving assistant message to Airtable:', saveError);
        console.error('Error details:', saveError.message);
        if (saveError.stack) {
          console.error('Error stack:', saveError.stack);
        }
      }
      
      // End the response
      res.write('event: message_stop\ndata: {"type": "message_stop"}\n\n');
      res.end();
    });
    
    // Handle errors in the stream
    response.data.on('error', (error) => {
      console.error('Stream error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    });
    
  } catch (error) {
    console.error('Error processing request:', error);
    
    // Try to send an error response if possible
    try {
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Error processing request',
          details: error.response ? error.response.data : error.message
        });
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      }
    } catch (responseError) {
      console.error('Error sending error response:', responseError);
    }
  }
};
