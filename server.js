// Force load dotenv at the top of the file
require('dotenv').config();
console.log('Dotenv loaded directly');

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const os = require('os');

// Load configuration
try {
  // Try to load from config.js (when packaged)
  const config = require('./config');
  config.setupEnv();
  console.log('Loaded configuration from config.js');
} catch (error) {
  // Fallback to dotenv (for development)
  console.log('Failed to load from config.js, falling back to dotenv:', error.message);
  // dotenv already loaded at the top
}

// Debug environment variables
console.log('All environment variables:', Object.keys(process.env));
console.log('Environment variables check:');
console.log('AIRTABLE_API_KEY exists:', !!process.env.AIRTABLE_API_KEY);
console.log('AIRTABLE_BASE_ID exists:', !!process.env.AIRTABLE_BASE_ID);
console.log('ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
console.log('ELEVENLABS_API_KEY exists:', !!process.env.ELEVENLABS_API_KEY);
console.log('GOOGLE_CLIENT_ID exists:', !!process.env.GOOGLE_CLIENT_ID);
console.log('GOOGLE_CLIENT_SECRET exists:', !!process.env.GOOGLE_CLIENT_SECRET ? 'Yes' : 'No');

// Add this new code to check for .env file
const envFilePath = path.join(__dirname, '.env');
console.log('Checking if .env exists at:', envFilePath);
console.log('.env file exists:', fs.existsSync(envFilePath));

if (!fs.existsSync(envFilePath)) {
  console.warn('\x1b[33m%s\x1b[0m', 'WARNING: No .env file found in project root!');
  console.warn('\x1b[33m%s\x1b[0m', 'Create a .env file with the following variables:');
  console.warn('\x1b[33m%s\x1b[0m', '  AIRTABLE_API_KEY=your_airtable_api_key');
  console.warn('\x1b[33m%s\x1b[0m', '  AIRTABLE_BASE_ID=your_airtable_base_id');
  console.warn('\x1b[33m%s\x1b[0m', '  ANTHROPIC_API_KEY=your_anthropic_api_key');
  console.warn('\x1b[33m%s\x1b[0m', '  ELEVENLABS_API_KEY=your_elevenlabs_api_key');
  console.warn('\x1b[33m%s\x1b[0m', '  GOOGLE_CLIENT_ID=your_google_client_id');
  console.warn('\x1b[33m%s\x1b[0m', '  GOOGLE_CLIENT_SECRET=your_google_client_secret');
  console.warn('\x1b[33m%s\x1b[0m', '  SESSION_SECRET=your_session_secret');
} else {
  console.log('\x1b[32m%s\x1b[0m', '.env file found in project root');
  
  // Try loading the .env file manually to debug
  try {
    const envContent = fs.readFileSync(envFilePath, 'utf8');
    console.log('.env file content (first 10 chars):', envContent.substring(0, 10) + '...');
    
    // Parse manually
    const envVars = envContent.split('\n').reduce((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        acc[match[1].trim()] = match[2].trim();
      }
      return acc;
    }, {});
    
    console.log('Manually parsed env vars:', Object.keys(envVars));
  } catch (error) {
    console.error('Error reading .env file:', error);
  }
}

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
app.use(express.json({ limit: '100mb' })); // Increase from default to 100mb
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'duoai-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Import Airtable service
const airtableService = require('./airtable-service');

// Passport configuration
console.log('Setting up Google Strategy with:');
console.log('- Client ID:', process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 5) + '...' : 'undefined');
console.log('- Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? '[REDACTED]' : 'undefined');

// Temporary workaround if environment variables are not loading
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('\x1b[33m%s\x1b[0m', 'WARNING: Using fallback values for Google OAuth credentials');
  // These are just placeholders and won't work for actual authentication
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'fallback-client-id';
  process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'fallback-client-secret';
}

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/callback',
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
  },
  async function(accessToken, refreshToken, profile, cb) {
    try {
      // Check if user exists in Airtable
      let user = await airtableService.findUserByGoogleId(profile.id);
      
      // If user doesn't exist, create a new one
      if (!user) {
        user = await airtableService.createUser(profile);
      } else {
        // Update last login time
        await airtableService.updateLastLogin(user.id);
      }
      
      // Return the user object
      return cb(null, user);
    } catch (error) {
      console.error('Error in Google auth strategy:', error);
      return cb(error, null);
    }
  }
));

// Serialize and deserialize user
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Claude API endpoint that accepts base64 images directly
app.post('/api/claude-base64', express.json({ limit: '100mb' }), async (req, res) => {
    try {
        console.log('Received request to /api/claude-base64');
        
        const { systemPrompt, userMessage, base64Image } = req.body;

        if (!base64Image) {
            console.error('No base64 image in request');
            return res.status(400).json({ error: 'No image provided' });
        }

        // Check if API key is available
        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('Anthropic API key is missing');
            return res.status(500).json({ error: 'API key configuration error' });
        }

        console.log('Preparing request to Claude API');
        console.log('System prompt length:', systemPrompt ? systemPrompt.length : 0);
        console.log('User message:', userMessage);
        
        // Prepare the request payload for Claude API
        const payload = {
            model: 'claude-3-7-sonnet-latest',  // Use a valid model
            system: systemPrompt || '',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: 'image/jpeg',  // Changed to jpeg since we're converting to jpeg
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

        console.log('Sending request to Claude API');
        
        // Call Claude API
        try {
            const response = await axios.post('https://api.anthropic.com/v1/messages', payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                }
            });
            
            console.log('Received response from Claude API');
            
            // Return Claude's response
            res.json({ response: response.data.content[0].text });
        } catch (apiError) {
            console.error('Error from Claude API:', apiError.message);
            if (apiError.response) {
                console.error('Claude API response status:', apiError.response.status);
                console.error('Claude API response data:', JSON.stringify(apiError.response.data, null, 2));
            }
            throw apiError;
        }
    } catch (error) {
        console.error('Error calling Claude API:', error.message);
        res.status(500).json({ 
            error: 'Error processing request',
            details: error.response ? error.response.data : error.message
        });
    }
});

// Claude streaming API endpoint
app.post('/api/claude-stream', express.json({ limit: '100mb' }), async (req, res) => {
    try {
        console.log('Received request to /api/claude-stream');
        
        const { systemPrompt, userMessage, base64Image } = req.body;

        if (!base64Image) {
            console.error('No base64 image in request');
            return res.status(400).json({ error: 'No image provided' });
        }

        // Check if API key is available
        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('Anthropic API key is missing');
            return res.status(500).json({ error: 'API key configuration error' });
        }

        console.log('Preparing streaming request to Claude API');
        console.log('System prompt length:', systemPrompt ? systemPrompt.length : 0);
        console.log('User message:', userMessage);
        
        // Set up headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        
        // Prepare the request payload for Claude API with streaming
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
                                media_type: 'image/jpeg',
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
            max_tokens: 4000,
            stream: true
        };

        console.log('Sending streaming request to Claude API');
        
        // Call Claude API with streaming
        const response = await axios.post('https://api.anthropic.com/v1/messages', payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            responseType: 'stream'
        });
        
        // Pipe the stream directly to the client
        response.data.pipe(res);
        
        // Handle errors in the stream
        response.data.on('error', (error) => {
            console.error('Stream error:', error);
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        });
    } catch (error) {
        console.error('Error calling Claude API streaming:', error.message);
        
        // Try to send an error response if possible
        try {
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: 'Error processing streaming request',
                    details: error.response ? error.response.data : error.message
                });
            } else {
                res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
                res.end();
            }
        } catch (responseError) {
            console.error('Error sending error response:', responseError);
        }
    }
});

// Claude API endpoint
app.post('/api/claude', upload.single('screenshot'), async (req, res) => {
    try {
        console.log('Received request to /api/claude');
        console.log('Request body fields:', Object.keys(req.body));
        console.log('Request files:', req.files);
        console.log('Request file:', req.file);
        
        const { systemPrompt, userMessage } = req.body;
        const screenshotFile = req.file;

        if (!screenshotFile) {
            console.error('No screenshot file in request');
            return res.status(400).json({ error: 'No screenshot provided' });
        }

        console.log('Screenshot file path:', screenshotFile.path);
        console.log('Screenshot file size:', screenshotFile.size);

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

// Google authentication routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect to the app
    res.redirect('/');
  });

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  if (req.isAuthenticated()) {
    // User data is already coming from Airtable via passport
    res.json({
      isAuthenticated: true,
      user: {
        id: req.user.id,
        name: req.user.Name || req.user.displayName,
        email: req.user.Email || (req.user.emails && req.user.emails[0] ? req.user.emails[0].value : ''),
        picture: req.user.ProfilePicture || (req.user.photos && req.user.photos[0] ? req.user.photos[0].value : '')
      }
    });
  } else {
    res.json({ isAuthenticated: false });
  }
});

// Logout route
app.get('/api/auth/logout', (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// Subscription plans
const SUBSCRIPTION_PLANS = {
    basic: {
        id: 'basic',
        name: 'Basic',
        price: 14.99,
        hoursPerMonth: 10
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 29.99,
        hoursPerMonth: 30
    },
    ultimate: {
        id: 'ultimate',
        name: 'Ultimate',
        price: 49.99,
        hoursPerMonth: Infinity // Unlimited
    }
};

// Get user subscription
app.get('/api/subscription', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        // Get subscription details from Airtable
        const subscription = await airtableService.getSubscription(req.user.id);
        
        // Get the plan details
        const planDetails = SUBSCRIPTION_PLANS[subscription.plan] || SUBSCRIPTION_PLANS.basic;
        
        // Format the response
        const response = {
            userId: req.user.id,
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodEnd: subscription.expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            hoursUsed: subscription.hoursUsed,
            hoursTotal: planDetails.hoursPerMonth
        };
        
        res.json(response);
    } catch (error) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({ error: 'Failed to fetch subscription details' });
    }
});

// Subscribe to a plan
app.post('/api/subscription', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { planId } = req.body;
    
    if (!SUBSCRIPTION_PLANS[planId]) {
        return res.status(400).json({ error: 'Invalid plan' });
    }
    
    try {
        // In a real app, you would process payment here
        // For now, we'll just update the subscription in Airtable
        
        // Set expiry date to 30 days from now
        const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        // Update subscription in Airtable
        await airtableService.updateSubscription(req.user.id, planId, 'active', expiryDate);
        
        // Reset hours used to 0 when subscribing to a new plan
        await airtableService.updateUser(req.user.id, { HoursUsed: 0 });
        
        // Get updated subscription
        const subscription = await airtableService.getSubscription(req.user.id);
        
        // Format the response
        const response = {
            userId: req.user.id,
            plan: planId,
            status: 'active',
            currentPeriodEnd: expiryDate,
            hoursUsed: 0,
            hoursTotal: SUBSCRIPTION_PLANS[planId].hoursPerMonth
        };
        
        res.json(response);
    } catch (error) {
        console.error('Error updating subscription:', error);
        res.status(500).json({ error: 'Failed to update subscription' });
    }
});

// Track usage time
app.post('/api/usage/start', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Start tracking session
    const sessionId = Date.now().toString();
    
    // Store session start time in session
    req.session.activeSession = {
        id: sessionId,
        startTime: Date.now()
    };
    
    res.json({ sessionId });
});

app.post('/api/usage/end', async (req, res) => {
    if (!req.isAuthenticated() || !req.session.activeSession) {
        return res.status(400).json({ error: 'No active session' });
    }
    
    const { sessionId } = req.body;
    
    if (req.session.activeSession.id !== sessionId) {
        return res.status(400).json({ error: 'Invalid session ID' });
    }
    
    try {
        // Calculate session duration in hours
        const duration = (Date.now() - req.session.activeSession.startTime) / (1000 * 60 * 60);
        
        // Update the user's usage in Airtable
        await airtableService.updateUsageHours(req.user.id, duration);
        
        // Clear the active session
        delete req.session.activeSession;
        
        res.json({ duration });
    } catch (error) {
        console.error('Error updating usage hours:', error);
        res.status(500).json({ error: 'Failed to update usage hours' });
    }
});

// Serve static files from the website directory
app.use(express.static(path.join(__dirname, 'website')));

// Whisper API endpoint for speech-to-text
app.post('/api/whisper', express.json({ limit: '10mb' }), async (req, res) => {
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
        
        // Save to temporary file
        const tempFilePath = path.join(os.tmpdir(), `whisper-${Date.now()}.webm`);
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
});

// Get ElevenLabs API key (without exposing it to the client)
app.get('/api/elevenlabs/key', (req, res) => {
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
});

// Text-to-speech endpoint
app.post('/api/elevenlabs/tts', async (req, res) => {
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
            const { ElevenLabsClient } = require('elevenlabs');
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
});

// Get available voices
app.get('/api/elevenlabs/voices', async (req, res) => {
    try {
        // Check if API key is available
        if (!process.env.ELEVENLABS_API_KEY) {
            console.error('ElevenLabs API key is missing');
            return res.status(500).json({ error: 'API key configuration error' });
        }
        
        // Initialize ElevenLabs client
        const { ElevenLabsClient } = require('elevenlabs');
        const client = new ElevenLabsClient({
            apiKey: process.env.ELEVENLABS_API_KEY
        });
        
        // Get all voices
        const voices = await client.voices.getAll();
        
        res.json({ voices });
    } catch (error) {
        console.error('Error getting ElevenLabs voices:', error);
        res.status(500).json({ 
            error: 'Error getting voices',
            details: error.message
        });
    }
});

// Serve the Electron app files for local development
app.use(express.static(__dirname));

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'website', 'index.html'));
});

// Start the server with error handling for port in use
const startServer = (port) => {
    app.listen(port)
        .on('listening', () => {
            console.log(`Server running on port ${port}`);
        })
        .on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`Port ${port} is already in use, trying port ${port + 1}`);
                // Try the next port
                startServer(port + 1);
            } else {
                console.error('Server error:', err);
            }
        });
};

// Start with the default port
startServer(port);
