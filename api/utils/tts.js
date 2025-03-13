const axios = require('axios');
const { handleCors, validateMethod } = require('./common');

module.exports = async function handler(req, res) {
  console.log('TTS API handler called');
  
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
    console.log('Processing TTS request');
    const { text, voiceId, model } = req.body;
    
    // Validate required parameters
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // Use default voice ID if not provided
    const selectedVoiceId = voiceId || 'IKne3meq5aSn9XLyUdCD'; // Default ElevenLabs voice ID
    
    // Use default model if not provided
    const selectedModel = model || 'eleven_flash_v2_5';
    
    // Get API key from environment variable
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }

    // Make request to ElevenLabs API using the streaming endpoint
    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}/stream?output_format=mp3_44100_128`,
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      data: {
        text: text,
        model_id: selectedModel,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        },
        // Add streaming optimization
        optimize_streaming_latency: 3 // Use max latency optimizations
      },
      responseType: 'stream' // Important: Use stream instead of arraybuffer
    });

    // Set appropriate headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Pipe the stream directly to the response
    response.data.pipe(res);
    
    // Handle errors in the stream
    response.data.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming audio' });
      }
    });
  } catch (error) {
    console.error('ElevenLabs TTS API error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({ 
      error: 'Error generating speech',
      details: error.response?.data || error.message
    });
  }
}
