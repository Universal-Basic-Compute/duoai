// bridge.js - Connects Electron app with the web server
const axios = require('axios');
const { loadConfig } = require('./config');

class AuthBridge {
    constructor() {
        // Always use production URL for authentication
        this.baseUrl = 'https://duoai.vercel.app';
        this.user = null;
        this.subscription = null;
    }
    
    /**
     * Register a new user with email and password
     * @param {string} username - User's username
     * @param {string} email - User's email
     * @param {string} password - User's password
     * @returns {Promise<Object>} - Registration result
     */
    async registerWithCredentials(username, email, password) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/auth/register`, {
                username,
                email,
                password
            });
            
            return {
                success: true,
                ...response.data
            };
        } catch (error) {
            console.error('Registration error:', error);
            
            if (error.response && error.response.data) {
                return {
                    success: false,
                    message: error.response.data.error || 'Registration failed'
                };
            }
            
            return { 
                success: false, 
                message: error.message || 'Registration failed. Please try again.' 
            };
        }
    }

    /**
     * Login with email and password
     * @param {string} email - User's email or username
     * @param {string} password - User's password
     * @returns {Promise<Object>} - Login result with tokens
     */
    async loginWithCredentials(email, password) {
        try {
            console.log('Attempting login with:', email); // Add logging
            
            const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
                email,
                password
            });
            
            return {
                success: true,
                ...response.data
            };
        } catch (error) {
            console.error('Login error:', error);
            
            if (error.response && error.response.data) {
                return {
                    success: false,
                    message: error.response.data.error || 'Login failed'
                };
            }
            
            return { 
                success: false, 
                message: error.message || 'Login failed. Please check your credentials.' 
            };
        }
    }

    async checkAuthStatus() {
        try {
            // Get token from localStorage
            const token = localStorage.getItem('authToken');
            
            if (!token) {
                return { isAuthenticated: false };
            }
            
            // Add token to request headers with base URL
            const response = await axios.get(`${this.baseUrl}/api/auth/status`, { 
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            // If response indicates token expired
            if (response.data.tokenExpired) {
                return { isAuthenticated: false, tokenExpired: true };
            }
            
            this.user = response.data.isAuthenticated ? response.data.user : null;
            return response.data;
        } catch (error) {
            console.error('Error checking auth status:', error);
            
            // If unauthorized error (401), token might be expired
            if (error.response && error.response.status === 401) {
                return { isAuthenticated: false, tokenExpired: true };
            }
            
            return { isAuthenticated: false };
        }
    }
    
    /**
     * Refresh the authentication token
     * @returns {Promise<boolean>} - True if token was refreshed successfully
     */
    async refreshToken() {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            
            if (!refreshToken) {
                console.log('No refresh token available in localStorage');
                return false;
            }
            
            console.log('Attempting to refresh token with URL:', `${this.baseUrl}/api/auth/refresh`);
            
            const response = await axios.post(`${this.baseUrl}/api/auth/refresh`, {
                refreshToken: refreshToken
            }, {
                // Add timeout to prevent hanging requests
                timeout: 10000,
                // Add headers to ensure proper content type
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.data && response.data.token) {
                // Store the new tokens
                localStorage.setItem('authToken', response.data.token);
                
                // Update refresh token if provided
                if (response.data.refreshToken) {
                    localStorage.setItem('refreshToken', response.data.refreshToken);
                }
                
                console.log('Token refreshed successfully');
                return true;
            }
            
            console.warn('Invalid response from refresh endpoint:', response.data);
            return false;
        } catch (error) {
            console.error('Error refreshing token:', error);
            
            // Check if it's a 404 error (endpoint not found)
            if (error.response && error.response.status === 404) {
                console.error('Refresh endpoint not found (404). Check your Vercel deployment.');
                
                // Try a fallback approach - direct login if we have credentials in localStorage
                try {
                    const storedCredentials = localStorage.getItem('userCredentials');
                    if (storedCredentials) {
                        const { email, password } = JSON.parse(storedCredentials);
                        console.log('Attempting fallback login with stored credentials');
                        
                        const loginResponse = await this.loginWithCredentials(email, password);
                        if (loginResponse.success) {
                            console.log('Fallback login successful');
                            return true;
                        }
                    }
                } catch (fallbackError) {
                    console.error('Fallback login failed:', fallbackError);
                }
            }
            
            return false;
        }
    }

    async checkSubscription() {
        try {
            const token = localStorage.getItem('authToken');
            
            if (!token) {
                return null;
            }
            
            const response = await axios.get(`${this.baseUrl}/api/subscription`, { 
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            this.subscription = response.data;
            return response.data;
        } catch (error) {
            console.error('Error checking subscription:', error);
            return null;
        }
    }

    async startUsageTracking() {
        try {
            const token = localStorage.getItem('authToken');
            
            if (!token) {
                return null;
            }
            
            const response = await axios.post(`${this.baseUrl}/api/usage/start`, {}, { 
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            return response.data;
        } catch (error) {
            console.error('Error starting usage tracking:', error);
            return null;
        }
    }

    async endUsageTracking(sessionId) {
        try {
            const token = localStorage.getItem('authToken');
            
            if (!token) {
                return null;
            }
            
            const response = await axios.post(`${this.baseUrl}/api/usage/end`, { sessionId }, { 
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            return response.data;
        } catch (error) {
            console.error('Error ending usage tracking:', error);
            return null;
        }
    }

    getLoginUrl() {
        return `${this.baseUrl}/auth/login`;
    }

    getLogoutUrl() {
        return `${this.baseUrl}/api/auth/logout`;
    }
}

    /**
     * Test API endpoints to diagnose deployment issues
     * @returns {Promise<Object>} - Results of endpoint tests
     */
    async testApiEndpoints() {
        const endpoints = [
            '/api/health',
            '/api/auth/status',
            '/api/auth/login',
            '/api/auth/refresh'
        ];
        
        const results = {};
        
        for (const endpoint of endpoints) {
            try {
                const url = `${this.baseUrl}${endpoint}`;
                console.log(`Testing endpoint: ${url}`);
                
                // Use OPTIONS request as it's typically allowed for CORS preflight
                const response = await axios.options(url, { timeout: 5000 });
                
                results[endpoint] = {
                    status: response.status,
                    success: response.status >= 200 && response.status < 300
                };
                
                console.log(`Endpoint ${endpoint} test result:`, results[endpoint]);
            } catch (error) {
                results[endpoint] = {
                    status: error.response ? error.response.status : 'network-error',
                    success: false,
                    error: error.message
                };
                
                console.error(`Endpoint ${endpoint} test failed:`, error.message);
            }
        }
        
        return results;
    }
}

// Create a singleton instance
const authBridge = new AuthBridge();

// Test API endpoints during initialization
authBridge.testApiEndpoints().then(results => {
    console.log('API endpoint test results:', results);
    
    // Check if refresh endpoint is accessible
    if (results['/api/auth/refresh'] && !results['/api/auth/refresh'].success) {
        console.warn('Refresh token endpoint is not accessible. Token refresh will not work.');
    }
});

module.exports = authBridge;
