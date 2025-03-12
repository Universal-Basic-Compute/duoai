const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { handleCors, validateMethod } = require('./common');

module.exports = async function handler(req, res) {
  console.log('LLM API handler called');
  
  // Handle CORS and validate request method
  if (handleCors(req, res)) {
    console.log('CORS handled, returning early');
    return;
  }
  
  if (!validateMethod(req, res)) {
    console.log('Method validation failed, returning early');
    return;
  }

  try {
    console.log('Processing LLM request');
    const { prompt, system, messages, images } = req.body;
    
    // Get API key from environment variable
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    // Load the base system prompt if not overridden
    let systemPrompt = system;
    if (!systemPrompt) {
      try {
        // Load base prompt
        const basePromptPath = path.join(process.cwd(), 'api', 'prompts', 'base_prompt.txt');
        const basePrompt = fs.readFileSync(basePromptPath, 'utf8');
        
        // Load character prompt (Zephyr)
        const characterPromptPath = path.join(process.cwd(), 'api', 'prompts', 'characters', 'zephyr.txt');
        let characterPrompt = '';
        try {
          characterPrompt = fs.readFileSync(characterPromptPath, 'utf8');
        } catch (charErr) {
          console.warn('Could not load character prompt:', charErr.message);
        }
        
        // Get a random mode from the modes directory
        const modesDir = path.join(process.cwd(), 'api', 'prompts', 'modes');
        let modePrompt = '';
        try {
          // Read all files in the modes directory
          const modeFiles = fs.readdirSync(modesDir);
          if (modeFiles.length > 0) {
            // Select a random mode file
            const randomModeFile = modeFiles[Math.floor(Math.random() * modeFiles.length)];
            const modePath = path.join(modesDir, randomModeFile);
            modePrompt = fs.readFileSync(modePath, 'utf8');
            console.log(`Using mode: ${randomModeFile}`);
          }
        } catch (modeErr) {
          console.warn('Could not load mode prompt:', modeErr.message);
        }
        
        // Combine prompts
        systemPrompt = basePrompt + '\n\n' + characterPrompt + '\n\n' + modePrompt;
      } catch (err) {
        console.warn('Could not load base prompt:', err.message);
      }
    }

    // Prepare the request payload
    const payload = {
      model: "claude-3-5-haiku-latest",
      max_tokens: 4096,
      temperature: 0.7,
    };

    // Add system prompt if available
    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    // Handle different input formats
    if (messages && Array.isArray(messages) && messages.length > 0) {
      // Filter out any system messages and use the first one as the system parameter
      const systemMessages = messages.filter(msg => msg.role === 'system');
      const nonSystemMessages = messages.filter(msg => msg.role !== 'system');
      
      // If there's a system message, use it as the system parameter
      if (systemMessages.length > 0 && !payload.system) {
        payload.system = systemMessages[0].content;
      }
      
      // Use only non-system messages in the messages array
      payload.messages = nonSystemMessages;
      
      // Add images to the last user message if provided
      if (images && Array.isArray(images) && images.length > 0 && 
          nonSystemMessages.length > 0 && nonSystemMessages[nonSystemMessages.length - 1].role === 'user') {
        
        const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];
        
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
