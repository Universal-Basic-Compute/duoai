const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

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

// Passport configuration
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
  },
  function(accessToken, refreshToken, profile, cb) {
    // In a production app, you would:
    // 1. Check if user exists in your database
    // 2. If not, create a new user
    // 3. Return the user object
    
    // For now, we'll just use the Google profile
    return cb(null, profile);
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
            model: 'claude-3-opus-20240229',  // Use a valid model
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
    res.json({
      isAuthenticated: true,
      user: {
        id: req.user.id,
        name: req.user.displayName,
        email: req.user.emails && req.user.emails[0] ? req.user.emails[0].value : '',
        picture: req.user.photos && req.user.photos[0] ? req.user.photos[0].value : ''
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
app.get('/api/subscription', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // In a real app, you would fetch this from your database
    // For now, we'll return a mock subscription
    const mockSubscription = {
        userId: req.user.id,
        plan: 'basic',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        hoursUsed: 2,
        hoursTotal: SUBSCRIPTION_PLANS.basic.hoursPerMonth
    };
    
    res.json(mockSubscription);
});

// Subscribe to a plan
app.post('/api/subscription', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { planId } = req.body;
    
    if (!SUBSCRIPTION_PLANS[planId]) {
        return res.status(400).json({ error: 'Invalid plan' });
    }
    
    // In a real app, you would:
    // 1. Process payment (Stripe, PayPal, etc.)
    // 2. Store subscription in database
    // 3. Return the updated subscription
    
    // For now, we'll return a mock successful subscription
    const mockSubscription = {
        userId: req.user.id,
        plan: planId,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        hoursUsed: 0,
        hoursTotal: SUBSCRIPTION_PLANS[planId].hoursPerMonth
    };
    
    res.json(mockSubscription);
});

// Track usage time
app.post('/api/usage/start', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Start tracking session
    // In a real app, you would store this in your database
    const sessionId = Date.now().toString();
    
    // Store session start time in memory (use a database in production)
    req.session.activeSession = {
        id: sessionId,
        startTime: Date.now()
    };
    
    res.json({ sessionId });
});

app.post('/api/usage/end', (req, res) => {
    if (!req.isAuthenticated() || !req.session.activeSession) {
        return res.status(400).json({ error: 'No active session' });
    }
    
    const { sessionId } = req.body;
    
    if (req.session.activeSession.id !== sessionId) {
        return res.status(400).json({ error: 'Invalid session ID' });
    }
    
    // Calculate session duration in hours
    const duration = (Date.now() - req.session.activeSession.startTime) / (1000 * 60 * 60);
    
    // In a real app, you would:
    // 1. Update the user's usage in the database
    // 2. Check if they've exceeded their limit
    
    // Clear the active session
    delete req.session.activeSession;
    
    res.json({ duration });
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

// Serve the Electron app files for local development
app.use(express.static(__dirname));

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'website', 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
