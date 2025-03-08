const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const airtableService = require('../airtable-service');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { code } = req.query;
        
        if (!code) {
            return res.status(400).json({ error: 'No authorization code provided' });
        }
        
        // Create OAuth client
        const client = new OAuth2Client(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.API_URL + '/api/auth/callback'
        );
        
        // Exchange code for tokens
        const { tokens } = await client.getToken(code);
        
        // Verify ID token
        const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        const googleId = payload.sub;
        
        // Find or create user in Airtable
        let user = await airtableService.findUserByGoogleId(googleId);
        
        if (!user) {
            // Create new user
            user = await airtableService.createUser({
                id: googleId,
                displayName: payload.name,
                emails: [{ value: payload.email }],
                photos: [{ value: payload.picture }]
            });
        } else {
            // Update last login
            await airtableService.updateLastLogin(user.id);
        }
        
        // Generate JWT token
        const jwtPayload = {
            user: {
                id: user.id,
                name: user.Name,
                email: user.Email,
                picture: user.ProfilePicture
            }
        };
        
        const token = jwt.sign(jwtPayload, process.env.JWT_SECRET || 'default-secret', { expiresIn: '1h' });
        const refreshToken = jwt.sign({ userId: user.id, googleId }, process.env.JWT_SECRET || 'default-secret', { expiresIn: '7d' });
        
        // Return a success page with the tokens
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authentication Successful</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 50px;
                        background: #f5f5f5;
                    }
                    .container {
                        background: white;
                        border-radius: 10px;
                        padding: 30px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        max-width: 500px;
                        margin: 0 auto;
                    }
                    h1 {
                        color: #4285F4;
                    }
                    .token {
                        background: #f9f9f9;
                        padding: 10px;
                        border-radius: 5px;
                        margin: 20px 0;
                        word-break: break-all;
                        text-align: left;
                        font-family: monospace;
                        font-size: 12px;
                    }
                    button {
                        background: #4285F4;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Authentication Successful</h1>
                    <p>You have successfully authenticated with Google. Please copy the tokens below and paste them in the app.</p>
                    
                    <h3>Auth Token:</h3>
                    <div class="token">${token}</div>
                    
                    <h3>Refresh Token:</h3>
                    <div class="token">${refreshToken}</div>
                    
                    <p>You can close this window now and return to the app.</p>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error in OAuth callback:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authentication Failed</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 50px;
                        background: #f5f5f5;
                    }
                    .container {
                        background: white;
                        border-radius: 10px;
                        padding: 30px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        max-width: 500px;
                        margin: 0 auto;
                    }
                    h1 {
                        color: #f44336;
                    }
                    .error {
                        background: #fff8f8;
                        padding: 10px;
                        border-radius: 5px;
                        margin: 20px 0;
                        color: #f44336;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Authentication Failed</h1>
                    <p>There was an error during the authentication process.</p>
                    
                    <div class="error">${error.message}</div>
                    
                    <p>Please close this window and try again.</p>
                </div>
            </body>
            </html>
        `);
    }
};
