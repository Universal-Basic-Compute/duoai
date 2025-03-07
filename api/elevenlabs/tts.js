const axios = require('axios');
const { ElevenLabsClient } = require('elevenlabs');

module.exports = async (req, res) => {
  try {
    console.log('Received request to /api/elevenlabs/tts');
    
    const { text, voiceId, modelId } = req.body;
    
    console.log('Text length:', text ? text.length : 0);
    console.log('Voice ID:', voiceId || 'default');
    console.log('Model ID:', modelId || 'default');
    
    if (!text || text.length < 2) {
      console.error('No text or text too short provided for TTS');
      return res.status(400).json({ error: 'No text or text too short provided' });
    }
    
    // Check if API key is available
    if (!process.env.ELEVENLABS_API_KEY) {
      console.error('ElevenLabs API key is missing');
      return res.status(500).json({ error: 'API key configuration error' });
    }
    
    console.log('Initializing ElevenLabs client');
    
    try {
      // Initialize ElevenLabs client
      const client = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY
      });
      
      console.log('Converting text to speech with ElevenLabs');
      
      // Convert text to speech with proper error handling
      try {
        const audio = await client.textToSpeech.convert(
          voiceId || "JBFqnCBsd6RMkjVDRZzb", // Default to Rachel voice
          {
            text: text,
            model_id: modelId || "eleven_flash_v2_5",
            output_format: "mp3_44100_128"
          }
        );
        
        if (!audio || audio.length < 1000) {
          throw new Error('Received invalid or empty audio from ElevenLabs');
        }
        
        console.log('Received audio from ElevenLabs, size:', audio.length);
        
        // Set response headers
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
        
        // Send the audio data
        res.send(Buffer.from(audio));
        console.log('Audio sent to client');
      } catch (elevenlabsError) {
        console.error('Error from ElevenLabs API:', elevenlabsError);
        throw new Error(`ElevenLabs API error: ${elevenlabsError.message}`);
      }
    } catch (clientError) {
      console.error('Error initializing ElevenLabs client:', clientError);
      throw new Error(`Failed to initialize ElevenLabs client: ${clientError.message}`);
    }
  } catch (error) {
    console.error('Error with ElevenLabs TTS:', error);
    console.error('Error details:', error.message);
    
    // Send a proper error response
    res.status(500).json({ 
      error: 'Error processing text-to-speech',
      details: error.message
    });
  }
};
