const { ElevenLabsClient } = require('elevenlabs');

module.exports = async (req, res) => {
  try {
    // Validate request method
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { text, voiceId, modelId } = req.body;
    
    // Validate input
    if (!text || text.length < 2) {
      return res.status(400).json({ error: 'No text or text too short provided' });
    }
    
    // Check if API key is available
    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'API key configuration error' });
    }
    
    // Initialize ElevenLabs client
    const client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY
    });
    
    // Set default values
    const finalVoiceId = voiceId || "JBFqnCBsd6RMkjVDRZzb"; // Default to Rachel voice
    const finalModelId = modelId || "eleven_flash_v2_5";
    
    // Convert text to speech with proper error handling and retries
    let retries = 0;
    const maxRetries = 2;
    let audio = null;
    
    while (retries <= maxRetries && !audio) {
      try {
        audio = await client.textToSpeech.convert(
          finalVoiceId,
          {
            text: text,
            model_id: finalModelId,
            output_format: "mp3_44100_128"
          }
        );
        
        if (!audio || audio.length < 1000) {
          throw new Error('Received invalid or empty audio from ElevenLabs');
        }
      } catch (elevenlabsError) {
        retries++;
        
        if (retries > maxRetries) {
          throw new Error(`ElevenLabs API error after ${maxRetries + 1} attempts: ${elevenlabsError.message}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
    
    // Set response headers
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    // Send the audio data
    res.send(Buffer.from(audio));
  } catch (error) {
    // Send a proper error response
    res.status(500).json({ 
      error: 'Error processing text-to-speech',
      details: error.message
    });
  }
};
