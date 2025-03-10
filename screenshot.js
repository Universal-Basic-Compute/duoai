const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');

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
                const originalFilePath = path.join(this.screenshotDir, `screenshot-original-${timestamp}.png`);
                const resizedFilePath = path.join(this.screenshotDir, `screenshot-${timestamp}.png`);
                
                // Request screenshot from main process
                ipcRenderer.once('screenshot-captured', async (event, error, base64Data) => {
                    if (error) {
                        console.error('Error from main process:', error);
                        reject(new Error(error));
                        return;
                    }
                    
                    try {
                        // Convert base64 to buffer and save original
                        const buffer = Buffer.from(base64Data, 'base64');
                        fs.writeFileSync(originalFilePath, buffer);
                        console.log('Original screenshot saved to:', originalFilePath);
                        
                        // Enhanced image processing:
                        // 1. Resize to 1024px width
                        // 2. Apply moderate sharpening to improve text readability
                        // 3. Optimize quality for better AI vision model processing
                        await sharp(originalFilePath)
                            .resize({ 
                                width: 1024, 
                                withoutEnlargement: true,
                                fit: 'inside'
                            })
                            .sharpen({
                                sigma: 1.2,
                                m1: 0.5,
                                m2: 0.5
                            })
                            .jpeg({ 
                                quality: 85,
                                progressive: true,
                                optimizeCoding: true
                            })
                            .toFile(resizedFilePath);
                        
                        console.log('Enhanced screenshot saved to:', resizedFilePath);
                        
                        // Delete the original file to save space
                        fs.unlinkSync(originalFilePath);
                        
                        resolve(resizedFilePath);
                    } catch (err) {
                        console.error('Error processing screenshot:', err);
                        // If processing fails, try to return the original file
                        if (fs.existsSync(originalFilePath)) {
                            console.log('Returning original screenshot as fallback');
                            resolve(originalFilePath);
                        } else {
                            reject(err);
                        }
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
            let cleanedCount = 0;
            
            files.forEach(file => {
                const filePath = path.join(this.screenshotDir, file);
                const stats = fs.statSync(filePath);
                const fileAge = now - stats.mtimeMs;
                
                if (fileAge > maxAge) {
                    fs.unlinkSync(filePath);
                    cleanedCount++;
                }
            });
            
            if (cleanedCount > 0) {
                console.log(`Cleaned up ${cleanedCount} old screenshots`);
            }
        } catch (error) {
            console.error('Error cleaning up screenshots:', error);
        }
    }
}

module.exports = new ScreenshotUtil();
