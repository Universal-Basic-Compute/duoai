module.exports = async (req, res) => {
  console.log('Received request for ElevenLabs API key');
  
  if (process.env.ELEVENLABS_API_KEY) {
    console.log('ElevenLabs API key found in environment variables');
    
    // Validate the key format (should be at least 32 characters)
    if (process.env.ELEVENLABS_API_KEY.length < 32) {
      console.error('ElevenLabs API key appears to be invalid (too short)');
      return res.status(500).json({ error: 'ElevenLabs API key appears to be invalid' });
    }
    
    const maskedKey = process.env.ELEVENLABS_API_KEY.substring(0, 4) + '...' + 
                      process.env.ELEVENLABS_API_KEY.substring(process.env.ELEVENLABS_API_KEY.length - 4);
    console.log('Returning masked key:', maskedKey);
    res.json({ key: process.env.ELEVENLABS_API_KEY, maskedKey });
  } else {
    console.error('ElevenLabs API key not found in environment variables');
    res.status(404).json({ error: 'ElevenLabs API key not found' });
  }
};
