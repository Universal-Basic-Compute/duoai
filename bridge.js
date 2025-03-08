// bridge.js - Connects Electron app with the web server
const axios = require('axios');
const { loadConfig } = require('./config');

class AuthBridge {
    constructor() {
        // Load config to get API URL
        const config = loadConfig();
        this.baseUrl = config.API_URL || 'https://duoai.vercel.app';
        this.user = null;
        this.subscription = null;
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
        return `${this.baseUrl}/auth/google`;
    }

    getLogoutUrl() {
        return `${this.baseUrl}/api/auth/logout`;
    }
}

module.exports = new AuthBridge();
