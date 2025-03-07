module.exports = async (req, res) => {
  console.log('Received request for ElevenLabs API key');
  
  if (process.env.ELEVENLABS_API_KEY) {
    const maskedKey = process.env.ELEVENLABS_API_KEY.substring(0, 4) + '...' + 
                      process.env.ELEVENLABS_API_KEY.substring(process.env.ELEVENLABS_API_KEY.length - 4);
    console.log('Returning ElevenLabs API key (masked):', maskedKey);
    res.json({ key: process.env.ELEVENLABS_API_KEY, maskedKey });
  } else {
    console.error('ElevenLabs API key not found in environment variables');
    res.status(404).json({ error: 'ElevenLabs API key not found' });
  }
};
