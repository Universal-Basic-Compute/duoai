const axios = require('axios');
const sharp = require('sharp');

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
  } catch (error) {
    res.status(500).json({ 
      error: 'Error processing request',
      details: error.response ? error.response.data : error.message
    });
  }
};
