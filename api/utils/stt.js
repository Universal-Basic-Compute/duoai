const axios = require('axios');
const formData = require('form-data');
const { handleCors, validateMethod } = require('./common');

module.exports = async function handler(req, res) {
  console.log('STT API handler called');
  
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
    console.log('Processing STT request');
    // Check if we have audio data
    if (!req.body || !req.body.audio) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    // Get API key from environment variable
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }

    // Decode base64 audio data
    const audioBuffer = Buffer.from(req.body.audio, 'base64');
    
    // Create form data
    const form = new formData();
    form.append('audio', audioBuffer, {
      filename: 'audio.mp3',
      contentType: 'audio/mpeg',
    });
    
    // Optional parameters
    if (req.body.language) {
      form.append('language', req.body.language);
    }
    
    // Make request to ElevenLabs Speech-to-Text API
    const response = await axios({
      method: 'POST',
      url: 'https://api.elevenlabs.io/v1/speech-to-text',
      headers: {
        'xi-api-key': apiKey,
        ...form.getHeaders()
      },
      data: form
    });

    // Return the transcription
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('ElevenLabs STT API error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({ 
      error: 'Error transcribing speech',
      details: error.response?.data || error.message
    });
  }
}
