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
    
    // Save user message to Airtable immediately
    try {
      // Extract character name from system prompt if available
      let characterName = null;
      if (systemPrompt) {
        const characterMatch = systemPrompt.match(/You are playing the role of (\w+)/i);
        if (characterMatch && characterMatch[1]) {
          characterName = characterMatch[1];
        }
      }
      
      // Save user message - use a mock user ID if req.user is not available
      const userId = req.user ? req.user.id : 'mock-user-id';
      
      await airtableService.saveMessage(
        userId,
        'user',
        userMessage || "What do you see in this screenshot?",
        characterName
      );
      
      console.log('User message saved to Airtable');
    } catch (saveError) {
      console.error('Error saving user message to Airtable:', saveError);
      // Don't fail the request if saving messages fails
    }
    
    // Prepare the request payload for Claude API with streaming enabled
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
                data: processedBase64
              }
            },
            {
              type: 'text',
              text: userMessage || "What do you see in this screenshot? Can you provide any gaming advice based on what you see?"
            }
          ]
        }
      ],
      max_tokens: 4000,
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
        
        // Save assistant message - use a mock user ID if req.user is not available
        const userId = req.user ? req.user.id : 'mock-user-id';
        
        if (fullResponse.length > 0) {
          await airtableService.saveMessage(
            userId,
            'assistant',
            fullResponse,
            characterName
          );
          
          console.log('Assistant message saved to Airtable');
        } else {
          console.error('No response text to save to Airtable');
        }
      } catch (saveError) {
        console.error('Error saving assistant message to Airtable:', saveError);
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
