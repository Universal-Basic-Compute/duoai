// bridge.js - Connects Electron app with the web server
const axios = require('axios');

class AuthBridge {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.user = null;
        this.subscription = null;
    }

    async checkAuthStatus() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/auth/status`, { withCredentials: true });
            this.user = response.data.isAuthenticated ? response.data.user : null;
            return response.data;
        } catch (error) {
            console.error('Error checking auth status:', error);
            return { isAuthenticated: false };
        }
    }

    async checkSubscription() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/subscription`, { withCredentials: true });
            this.subscription = response.data;
            return response.data;
        } catch (error) {
            console.error('Error checking subscription:', error);
            return null;
        }
    }

    async startUsageTracking() {
        try {
            const response = await axios.post(`${this.baseUrl}/api/usage/start`, {}, { withCredentials: true });
            return response.data;
        } catch (error) {
            console.error('Error starting usage tracking:', error);
            return null;
        }
    }

    async endUsageTracking(sessionId) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/usage/end`, { sessionId }, { withCredentials: true });
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
