const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads', { recursive: true });
        }
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Use a unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'screenshot-' + uniqueSuffix + '.png');
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Claude API endpoint
app.post('/api/claude', upload.single('screenshot'), async (req, res) => {
    try {
        console.log('Received request to /api/claude');
        console.log('Request body fields:', Object.keys(req.body));
        console.log('File received:', req.file ? 'Yes' : 'No');
        
        const { systemPrompt, userMessage } = req.body;
        const screenshotFile = req.file;

        if (!screenshotFile) {
            console.error('No screenshot file in request');
            return res.status(400).json({ error: 'No screenshot provided' });
        }

        console.log('Screenshot file path:', screenshotFile.path);

        // Read the screenshot file
        const imageBuffer = fs.readFileSync(screenshotFile.path);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = 'image/png';

        // Prepare the request payload for Claude API
        const payload = {
            model: 'claude-3-7-sonnet-latest',
            system: systemPrompt || '',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mimeType,
                                data: base64Image
                            }
                        },
                        {
                            type: 'text',
                            text: userMessage || "What do you see in this screenshot? Can you provide any gaming advice based on what you see?"
                        }
                    ]
                }
            ],
            max_tokens: 4000
        };

        // Call Claude API
        const response = await axios.post('https://api.anthropic.com/v1/messages', payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            }
        });

        // Clean up the uploaded file
        fs.unlinkSync(screenshotFile.path);

        // Return Claude's response
        res.json({ response: response.data.content[0].text });
    } catch (error) {
        console.error('Error calling Claude API:', error);
        
        // Clean up the uploaded file if it exists
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            error: 'Error processing request',
            details: error.response ? error.response.data : error.message
        });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
