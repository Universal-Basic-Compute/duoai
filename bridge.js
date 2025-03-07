// bridge.js - Connects Electron app with the web server
const axios = require('axios');

class AuthBridge {
    constructor() {
        // Use relative URLs for serverless functions
        this.baseUrl = '';
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
            
            // Add token to request headers
            const response = await axios.get(`/api/auth/status`, { 
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            // If response indicates token expired
            if (response.data.tokenExpired) {
                // Try to refresh the token
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    // Retry with new token
                    return this.checkAuthStatus();
                }
                return { isAuthenticated: false };
            }
            
            this.user = response.data.isAuthenticated ? response.data.user : null;
            return response.data;
        } catch (error) {
            console.error('Error checking auth status:', error);
            
            // If unauthorized error (401), try to refresh token
            if (error.response && error.response.status === 401) {
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    // Retry with new token
                    return this.checkAuthStatus();
                }
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
            
            const response = await axios.post(`/api/auth/refresh`, {
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
            const response = await axios.get(`/api/subscription`, { withCredentials: true });
            this.subscription = response.data;
            return response.data;
        } catch (error) {
            console.error('Error checking subscription:', error);
            return null;
        }
    }

    async startUsageTracking() {
        try {
            const response = await axios.post(`/api/usage/start`, {}, { withCredentials: true });
            return response.data;
        } catch (error) {
            console.error('Error starting usage tracking:', error);
            return null;
        }
    }

    async endUsageTracking(sessionId) {
        try {
            const response = await axios.post(`/api/usage/end`, { sessionId }, { withCredentials: true });
            return response.data;
        } catch (error) {
            console.error('Error ending usage tracking:', error);
            return null;
        }
    }

    getLoginUrl() {
        return `/auth/google`;
    }

    getLogoutUrl() {
        return `/api/auth/logout`;
    }
}

module.exports = new AuthBridge();
