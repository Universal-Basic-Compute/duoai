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
     * @param {string} email - User's email
     * @param {string} password - User's password
     * @returns {Promise<Object>} - Login result with tokens
     */
    async loginWithCredentials(email, password) {
        try {
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
                return false;
            }
            
            const response = await axios.post(`${this.baseUrl}/api/auth/refresh`, {
                refreshToken: refreshToken
            });
            
            if (response.data && response.data.token) {
                localStorage.setItem('authToken', response.data.token);
                
                // Update refresh token if provided
                if (response.data.refreshToken) {
                    localStorage.setItem('refreshToken', response.data.refreshToken);
                }
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error refreshing token:', error);
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

module.exports = new AuthBridge();
