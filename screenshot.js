const { desktopCapturer, screen } = require('electron');
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
            // Get all available sources
            const sources = await desktopCapturer.getSources({ 
                types: ['screen'],
                thumbnailSize: { width: 1920, height: 1080 }
            });

            // Use the primary display (first source)
            const primarySource = sources[0];
            
            if (!primarySource) {
                throw new Error('No screen source found');
            }

            // Get the thumbnail as a data URL
            const thumbnail = primarySource.thumbnail.toDataURL();
            
            // Convert data URL to buffer
            const base64Data = thumbnail.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Save the screenshot to a file
            const timestamp = new Date().getTime();
            const filePath = path.join(this.screenshotDir, `screenshot-${timestamp}.png`);
            fs.writeFileSync(filePath, buffer);
            
            return filePath;
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
