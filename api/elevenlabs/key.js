module.exports = async (req, res) => {
  if (process.env.ELEVENLABS_API_KEY) {
    const maskedKey = process.env.ELEVENLABS_API_KEY.substring(0, 4) + '...' + 
                      process.env.ELEVENLABS_API_KEY.substring(process.env.ELEVENLABS_API_KEY.length - 4);
    res.json({ key: process.env.ELEVENLABS_API_KEY, maskedKey });
  } else {
    res.status(404).json({ error: 'ElevenLabs API key not found' });
  }
};
