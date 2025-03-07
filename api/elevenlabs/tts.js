const axios = require('axios');
const { ElevenLabsClient } = require('elevenlabs');

/**
 * Text-to-speech API endpoint using ElevenLabs
 * 
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<void>}
 */
module.exports = async (req, res) => {
  try {
    console.log('Received request to /api/elevenlabs/tts');
    
    // Validate request method
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { text, voiceId, modelId } = req.body;
    
    console.log('Text length:', text ? text.length : 0);
    console.log('Voice ID:', voiceId || 'default');
    console.log('Model ID:', modelId || 'default');
    
    // Validate input
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
          console.error(`ElevenLabs API error (attempt ${retries}/${maxRetries + 1}):`, elevenlabsError);
          
          if (retries > maxRetries) {
            throw new Error(`ElevenLabs API error after ${maxRetries + 1} attempts: ${elevenlabsError.message}`);
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
      
      console.log('Received audio from ElevenLabs, size:', audio.length);
      
      // Set response headers
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      
      // Send the audio data
      res.send(Buffer.from(audio));
      console.log('Audio sent to client');
    } catch (clientError) {
      console.error('Error with ElevenLabs client:', clientError);
      throw new Error(`Failed to generate speech: ${clientError.message}`);
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
