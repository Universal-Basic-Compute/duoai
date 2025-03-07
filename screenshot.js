const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ScreenshotUtil {
    constructor() {
        this.screenshotDir = path.join(os.tmpdir(), 'duoai-screenshots');
        
        // Create the screenshots directory if it doesn't exist
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }
    }

    /**
     * Capture a screenshot of the primary display
     * @returns {Promise<string>} - Path to the saved screenshot
     */
    async captureScreenshot() {
        try {
            console.log('Requesting screenshot from main process...');
            
            // Use IPC to request a screenshot from the main process
            return new Promise((resolve, reject) => {
                // Generate a unique filename
                const timestamp = new Date().getTime();
                const filePath = path.join(this.screenshotDir, `screenshot-${timestamp}.png`);
                
                // Request screenshot from main process
                ipcRenderer.once('screenshot-captured', (event, error, base64Data) => {
                    if (error) {
                        console.error('Error from main process:', error);
                        reject(new Error(error));
                        return;
                    }
                    
                    try {
                        // Convert base64 to buffer and save
                        const buffer = Buffer.from(base64Data, 'base64');
                        fs.writeFileSync(filePath, buffer);
                        console.log('Screenshot saved to:', filePath);
                        resolve(filePath);
                    } catch (err) {
                        console.error('Error saving screenshot:', err);
                        reject(err);
                    }
                });
                
                // Send request to main process
                ipcRenderer.send('capture-screenshot');
            });
        } catch (error) {
            console.error('Error capturing screenshot:', error);
            throw error;
        }
    }

    /**
     * Clean up old screenshots
     * @param {number} maxAge - Maximum age in milliseconds
     */
    cleanupOldScreenshots(maxAge = 24 * 60 * 60 * 1000) { // Default: 24 hours
        try {
            const files = fs.readdirSync(this.screenshotDir);
            const now = new Date().getTime();
            
            files.forEach(file => {
                const filePath = path.join(this.screenshotDir, file);
                const stats = fs.statSync(filePath);
                const fileAge = now - stats.mtimeMs;
                
                if (fileAge > maxAge) {
                    fs.unlinkSync(filePath);
                }
            });
        } catch (error) {
            console.error('Error cleaning up screenshots:', error);
        }
    }
}

module.exports = new ScreenshotUtil();
