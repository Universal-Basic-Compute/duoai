const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = async (req, res) => {
    try {
        // Set CORS headers to allow requests from any origin
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }
        
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
        
        // Save to temporary file
        const tempDir = path.join(os.tmpdir(), 'duoai-whisper');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFilePath = path.join(tempDir, `whisper-${Date.now()}.webm`);
        fs.writeFileSync(tempFilePath, audioBuffer);
        
        try {
            // Call OpenAI Whisper API
            const formData = new FormData();
            formData.append('file', fs.createReadStream(tempFilePath));
            formData.append('model', 'whisper-1');
            
            const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                }
            });
            
            // Clean up temp file
            fs.unlinkSync(tempFilePath);
            
            // Return transcription
            res.json({ transcription: response.data.text });
        } catch (apiError) {
            console.error('Error calling Whisper API:', apiError.message);
            if (apiError.response) {
                console.error('Whisper API response status:', apiError.response.status);
                console.error('Whisper API response data:', JSON.stringify(apiError.response.data, null, 2));
            }
            
            // Clean up temp file
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
            
            throw apiError;
        }
    } catch (error) {
        console.error('Error processing audio:', error.message);
        res.status(500).json({ 
            error: 'Error processing audio',
            details: error.response ? error.response.data : error.message
        });
    }
};
