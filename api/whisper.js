const axios = require('axios');
const FormData = require('form-data');

module.exports = async (req, res) => {
  try {
    const { audioData } = req.body;
    
    if (!audioData) {
      return res.status(400).json({ error: 'No audio data provided' });
    }
    
    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is missing');
      return res.status(500).json({ error: 'API key configuration error' });
    }
    
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Create form data with the audio buffer directly (no file system operations)
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.webm',
      contentType: 'audio/webm',
    });
    formData.append('model', 'whisper-1');
    
    // Call OpenAI Whisper API
    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });
    
    // Return transcription
    res.json({ transcription: response.data.text });
  } catch (error) {
    console.error('Error processing audio:', error.message);
    res.status(500).json({ 
      error: 'Error processing audio',
      details: error.response ? error.response.data : error.message
    });
  }
};
