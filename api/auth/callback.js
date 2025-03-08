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
            'https://duoai.vercel.app/api/auth/callback'
        );
        
        console.log('OAuth client created with redirect URI: https://duoai.vercel.app/api/auth/callback');
        
        console.log('Attempting to exchange code for tokens');
        
        // Exchange code for tokens
        const { tokens } = await client.getToken(code);
        
        // Log successful token exchange
        console.log('Successfully exchanged code for tokens');
        
        // Verify ID token
        const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        console.log('Successfully verified ID token');
        
        const payload = ticket.getPayload();
        const googleId = payload.sub;
        
        console.log('Google user ID:', googleId);
        
        // Find or create user in Airtable
        let user = await airtableService.findUserByGoogleId(googleId);
        
        if (!user) {
            console.log('User not found, creating new user');
            // Create new user
            user = await airtableService.createUser({
                id: googleId,
                displayName: payload.name,
                emails: [{ value: payload.email }],
                photos: [{ value: payload.picture }]
            });
        } else {
            console.log('User found, updating last login');
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
        
        console.log('Generated JWT tokens');
        
        // Return a success page that automatically sends the tokens back to the app
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
                    .success-message {
                        margin: 20px 0;
                        color: #00C853;
                        font-weight: bold;
                    }
                    #status {
                        margin: 20px 0;
                    }
                    .spinner {
                        border: 4px solid rgba(0, 0, 0, 0.1);
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        border-left-color: #4285F4;
                        animation: spin 1s linear infinite;
                        margin: 20px auto;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
                <script>
                    // Function to send tokens to the app
                    function sendTokensToApp() {
                        try {
                            // Create the data object
                            const authData = {
                                type: 'google-auth-callback',
                                token: '${token}',
                                refreshToken: '${refreshToken}',
                                user: ${JSON.stringify(jwtPayload.user)}
                            };
                            
                            // Try different methods to communicate with the app
                            
                            // Method 1: Use window.opener if available
                            if (window.opener) {
                                window.opener.postMessage(authData, '*');
                                document.getElementById('status').textContent = 'Authentication successful! Returning to app...';
                                setTimeout(() => window.close(), 2000);
                                return;
                            }
                            
                            // Method 2: Try to use a custom protocol
                            const protocolUrl = 'duoai://auth?' + encodeURIComponent(JSON.stringify(authData));
                            document.getElementById('status').textContent = 'Redirecting to app...';
                            
                            // Create an invisible iframe to try the protocol without leaving this page
                            const iframe = document.createElement('iframe');
                            iframe.style.display = 'none';
                            iframe.src = protocolUrl;
                            document.body.appendChild(iframe);
                            
                            // Set a timeout to check if the protocol handler worked
                            setTimeout(() => {
                                // If we're still here, try to redirect
                                window.location.href = protocolUrl;
                                
                                // Show manual copy option after a delay
                                setTimeout(() => {
                                    document.getElementById('status').textContent = 'Please copy these tokens to the app:';
                                    document.getElementById('tokens').style.display = 'block';
                                    document.getElementById('spinner').style.display = 'none';
                                }, 3000);
                            }, 1000);
                        } catch (error) {
                            console.error('Error sending tokens to app:', error);
                            document.getElementById('status').textContent = 'Please copy these tokens to the app:';
                            document.getElementById('tokens').style.display = 'block';
                            document.getElementById('spinner').style.display = 'none';
                        }
                    }
                    
                    // Run when page loads
                    window.onload = sendTokensToApp;
                </script>
            </head>
            <body>
                <div class="container">
                    <h1>Authentication Successful</h1>
                    <p id="status">Processing authentication...</p>
                    <div id="spinner" class="spinner"></div>
                    
                    <div id="tokens" style="display: none;">
                        <h3>Auth Token:</h3>
                        <textarea rows="3" style="width: 100%;" onclick="this.select()">${token}</textarea>
                        
                        <h3>Refresh Token:</h3>
                        <textarea rows="3" style="width: 100%;" onclick="this.select()">${refreshToken}</textarea>
                        
                        <p>Copy these tokens and paste them in the app.</p>
                    </div>
                    
                    <div class="success-message">
                        You have successfully authenticated with Google.
                    </div>
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
