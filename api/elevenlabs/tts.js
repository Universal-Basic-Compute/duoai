const axios = require('axios');

module.exports = async (req, res) => {
  try {
    // Validate request method
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { text, voiceId, modelId } = req.body;
    
    console.log('ElevenLabs TTS request received:');
    console.log('- Text length:', text ? text.length : 0);
    console.log('- Voice ID:', voiceId || 'default');
    console.log('- Model ID:', modelId || 'default');
    console.log('- Text (first 50 chars):', text ? text.substring(0, 50) + '...' : 'undefined');
    
    // Validate input
    if (!text || text.length < 2) {
      return res.status(400).json({ error: 'No text or text too short provided' });
    }
    
    // Check if API key is available
    if (!process.env.ELEVENLABS_API_KEY) {
      console.error('ElevenLabs API key is missing');
      return res.status(500).json({ error: 'API key configuration error' });
    }
    
    console.log('Using ElevenLabs API key:', 
                process.env.ELEVENLABS_API_KEY ? process.env.ELEVENLABS_API_KEY.substring(0, 4) + '...' : 'undefined');
    
    try {
      // Set default values
      const finalVoiceId = voiceId || "JBFqnCBsd6RMkjVDRZzb"; // Default to Rachel voice
      const finalModelId = modelId || "eleven_flash_v2_5";  // Use a more stable model
      
      console.log('Converting text to speech with ElevenLabs:');
      console.log('- Final Voice ID:', finalVoiceId);
      console.log('- Final Model ID:', finalModelId);
      console.log('- API Key first 4 chars:', process.env.ELEVENLABS_API_KEY.substring(0, 4));
      
      // Convert text to speech with proper error handling and retries
      let retries = 0;
      const maxRetries = 2;
      let audio = null;
      
      while (retries <= maxRetries && !audio) {
        try {
          console.log(`Attempt ${retries + 1} to convert text to speech`);
          
          // Trim text if it's too long (ElevenLabs has character limits)
          const trimmedText = text.length > 5000 ? text.substring(0, 5000) + "..." : text;
          console.log(`Text length after trimming: ${trimmedText.length}`);
          
          try {
            console.log(`Calling ElevenLabs API with voice ID: ${finalVoiceId}`);
            console.log(`Using model ID: ${finalModelId}`);
            
            // Use direct API call with axios
            const apiResponse = await axios({
              method: 'POST',
              url: `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}`,
              headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': process.env.ELEVENLABS_API_KEY
              },
              data: {
                text: trimmedText,
                model_id: finalModelId,
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.75
                }
              },
              responseType: 'arraybuffer'
            });
            
            // Get audio directly as a buffer
            audio = apiResponse.data;
            
            // Log successful conversion
            console.log(`Successfully converted ${trimmedText.length} characters to speech`);
            
            // Check if audio is valid and log its size
            if (!audio) {
              console.error('Received empty audio from ElevenLabs');
              throw new Error('Received empty audio from ElevenLabs');
            }
            
            const audioSize = audio.length || audio.byteLength || 0;
            console.log('Received audio from ElevenLabs, size:', audioSize);
            
            if (audioSize < 1000) {
              console.error('Audio size is too small:', audioSize, 'bytes');
              console.error('This is likely not a valid audio file');
              throw new Error('Received invalid or too small audio from ElevenLabs');
            }
          } catch (apiCallError) {
            console.error('Error in ElevenLabs API call:', apiCallError);
            console.error('Error details:', apiCallError.message);
            if (apiCallError.response) {
              console.error('Response status:', apiCallError.response.status);
              console.error('Response data:', apiCallError.response.data);
            }
            throw apiCallError;
          }
        } catch (elevenlabsError) {
          console.error('ElevenLabs API error:', elevenlabsError);
          
          retries++;
          
          if (retries > maxRetries) {
            console.error(`Failed after ${maxRetries + 1} attempts`);
            throw new Error(`ElevenLabs API error after ${maxRetries + 1} attempts: ${elevenlabsError.message}`);
          }
          
          console.log(`Retrying (${retries}/${maxRetries})...`);
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
      
      console.log('Setting response headers');
      
      // Set response headers
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      res.setHeader('Access-Control-Allow-Origin', '*'); // Allow cross-origin requests
      
      console.log('Sending audio data to client, size:', audio.length);
      
      // Send the audio data
      res.send(audio);
      
      console.log('Audio sent successfully');
    } catch (clientError) {
      console.error('Error calling ElevenLabs API:', clientError);
      throw new Error(`ElevenLabs error: ${clientError.message}`);
    }
  } catch (error) {
    console.error('Error in ElevenLabs TTS endpoint:', error);
    console.error('Error stack:', error.stack);
    
    // Send a proper error response
    res.status(500).json({ 
      error: 'Error processing text-to-speech',
      details: error.message
    });
  }
};
