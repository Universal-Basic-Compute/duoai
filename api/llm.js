import axios from 'axios';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, system, messages, images } = req.body;
    
    // Get API key from environment variable
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    // Prepare the request payload
    const payload = {
      model: "claude-3-5-haiku-20240307",
      max_tokens: 4096,
      temperature: 0.7,
    };

    // Add system prompt if provided
    if (system) {
      payload.system = system;
    }

    // Handle different input formats
    if (messages && Array.isArray(messages) && messages.length > 0) {
      // Use conversation messages format
      payload.messages = messages;
      
      // Add images to the last user message if provided
      if (images && Array.isArray(images) && images.length > 0 && 
          messages.length > 0 && messages[messages.length - 1].role === 'user') {
        
        const lastMessage = messages[messages.length - 1];
        
        // Convert the content to array format if it's a string
        if (typeof lastMessage.content === 'string') {
          lastMessage.content = [{ type: 'text', text: lastMessage.content }];
        }
        
        // Add each image to the content array
        for (const imageData of images) {
          lastMessage.content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageData.media_type || 'image/jpeg',
              data: imageData.data
            }
          });
        }
      }
    } else if (prompt) {
      // Use simple prompt format
      payload.messages = [
        { role: 'user', content: prompt }
      ];
      
      // Add images if provided
      if (images && Array.isArray(images) && images.length > 0) {
        const content = [];
        content.push({ type: 'text', text: prompt });
        
        for (const imageData of images) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageData.media_type || 'image/jpeg',
              data: imageData.data
            }
          });
        }
        
        payload.messages[0].content = content;
      }
    } else {
      return res.status(400).json({ error: 'Either prompt or messages must be provided' });
    }

    // Make request to Anthropic API
    const response = await axios({
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      data: payload
    });

    // Return the response
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Anthropic API error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({ 
      error: 'Error generating response',
      details: error.response?.data || error.message
    });
  }
}
