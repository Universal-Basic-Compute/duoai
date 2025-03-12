const axios = require('axios');
const { handleCors, validateMethod } = require('./common');

module.exports = async function handler(req, res) {
  // Handle CORS and validate request method
  if (handleCors(req, res)) return;
  if (!validateMethod(req, res)) return;

  try {
    const { text, voiceId, model } = req.body;
    
    // Validate required parameters
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // Use default voice ID if not provided
    const selectedVoiceId = voiceId || 'pNInz6obpgDQGcFmaJgB'; // Default ElevenLabs voice ID
    
    // Use default model if not provided
    const selectedModel = model || 'eleven_multilingual_v2';
    
    // Get API key from environment variable
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }

    // Make request to ElevenLabs API
    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
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
        }
      },
      responseType: 'arraybuffer'
    });

    // Set appropriate headers for audio response
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
    
    // Return the audio data
    return res.status(200).send(Buffer.from(response.data));
  } catch (error) {
    console.error('ElevenLabs TTS API error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({ 
      error: 'Error generating speech',
      details: error.response?.data || error.message
    });
  }
}
