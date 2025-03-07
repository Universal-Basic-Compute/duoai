const axios = require('axios');
const sharp = require('sharp');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Received request to /api/claude-base64');
    
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
    
    // Process image with sharp in memory (no file system operations)
    const imageBuffer = Buffer.from(base64Image, 'base64');
    let processedBase64;
    
    // Compress the image if it's too large
    if (imageBuffer.length > 5 * 1024 * 1024) {
      console.log('Image is large, compressing further...');
      const processedImageBuffer = await sharp(imageBuffer)
        .resize({ width: 800 })
        .jpeg({ quality: 70 })
        .toBuffer();
      
      processedBase64 = processedImageBuffer.toString('base64');
      console.log('Image compressed successfully');
    } else {
      // Convert to JPEG for better compression
      const processedImageBuffer = await sharp(imageBuffer)
        .jpeg({ quality: 85 })
        .toBuffer();
      
      processedBase64 = processedImageBuffer.toString('base64');
      console.log('Image converted to JPEG');
    }
    
    console.log('Image size (base64):', Math.round(processedBase64.length / 1024), 'KB');
    
    // Prepare the request payload for Claude API
    const payload = {
      model: 'claude-3-opus-20240229',
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
      max_tokens: 4000
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
