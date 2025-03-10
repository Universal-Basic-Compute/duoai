const { app, BrowserWindow, ipcMain, screen, desktopCapturer, shell, protocol, dialog, powerSaveBlocker } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

// Set up error logging to file
const logFilePath = path.join(__dirname, 'duoai-error.log');
console.log(`Logging errors to: ${logFilePath}`);

// Create a write stream for the log file
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Redirect console.error to the log file
const originalConsoleError = console.error;
console.error = function() {
    // Convert arguments to string
    const args = Array.from(arguments).map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    });
    
    // Write to log file with timestamp
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${args.join(' ')}\n`;
    logStream.write(logMessage);
    
    // Also log to original console.error
    originalConsoleError.apply(console, arguments);
};

// Log unhandled exceptions
process.on('uncaughtException', (error) => {
    const errorMessage = `CRITICAL ERROR: ${error.message}\nStack: ${error.stack}`;
    console.error('Uncaught Exception:', error);
    console.error('Stack trace:', error.stack);
    
    // Write to log file directly
    try {
        fs.writeFileSync(logFilePath, `[${new Date().toISOString()}] ${errorMessage}\n`, { flag: 'a' });
    } catch (fsError) {
        console.error('Failed to write to log file:', fsError);
    }
    
    // Show error dialog
    if (app.isReady()) {
        dialog.showErrorBox('DUOAI Error', 
            `The application encountered a critical error:\n\n${error.message}\n\n` +
            `This error has been logged to: ${logFilePath}`);
    } else {
        app.on('ready', () => {
            dialog.showErrorBox('DUOAI Error', 
                `The application encountered a critical error:\n\n${error.message}\n\n` +
                `This error has been logged to: ${logFilePath}`);
        });
    }
    
    // Don't exit the app immediately to allow the error to be logged
    setTimeout(() => {
        app.exit(1);
    }, 1000);
});

// Log unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
    if (reason && reason.stack) {
        console.error('Stack trace:', reason.stack);
    }
});

// Log app errors
app.on('render-process-gone', (event, webContents, details) => {
    console.error('Render process gone:', details.reason, details.exitCode);
});

app.on('child-process-gone', (event, details) => {
    console.error('Child process gone:', details.type, details.reason, details.exitCode);
});

// Add these variables at the top level
let powerSaveBlockerId = null;
let audioPlaybackActive = false;

// Log startup information
console.log(`Starting DUOAI application (version ${app.getVersion()})`);
console.log(`Electron version: ${process.versions.electron}`);
console.log(`Chrome version: ${process.versions.chrome}`);
console.log(`Node version: ${process.versions.node}`);
console.log(`Platform: ${process.platform} (${process.arch})`);
console.log(`App path: ${app.getAppPath()}`);
console.log(`User data path: ${app.getPath('userData')}`);

// Check for missing dependencies
function checkDependencies() {
    const missingDeps = [];
    
    try {
        require('electron');
    } catch (e) {
        missingDeps.push('electron');
    }
    
    try {
        require('axios');
    } catch (e) {
        missingDeps.push('axios');
    }
    
    try {
        require('dotenv');
    } catch (e) {
        missingDeps.push('dotenv');
    }
    
    // Add other critical dependencies here
    
    if (missingDeps.length > 0) {
        console.error(`Missing dependencies: ${missingDeps.join(', ')}`);
        if (app.isReady()) {
            const { dialog } = require('electron');
            dialog.showErrorBox('Missing Dependencies', 
                `The following dependencies are missing: ${missingDeps.join(', ')}\n\n` +
                `Please run 'npm install' to install the required dependencies.`);
        }
        return false;
    }
    
    return true;
}

// Environment variables
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const isMac = process.platform === 'darwin';

// Set NODE_ENV to development if app is not packaged
if (!app.isPackaged) {
    process.env.NODE_ENV = 'development';
    console.log('Running in development mode');
}

// Helper function to get asset paths
function getAssetPath(...paths) {
  if (app.isPackaged) {
    // In packaged app, resources are in the resources directory
    return path.join(process.resourcesPath, ...paths);
  } else {
    // In development, try multiple locations
    const rootPath = path.join(__dirname, ...paths);
    if (fs.existsSync(rootPath)) {
      return rootPath;
    }
    
    // Try website directory
    const websitePath = path.join(__dirname, 'website', ...paths);
    if (fs.existsSync(websitePath)) {
      return websitePath;
    }
    
    // Default to root directory
    return rootPath;
  }
}

// Check for .env file
const envFilePath = path.join(__dirname, '.env');
if (!fs.existsSync(envFilePath)) {
  console.warn('\x1b[33m%s\x1b[0m', 'WARNING: No .env file found in project root!');
  console.warn('\x1b[33m%s\x1b[0m', 'Some features may not work correctly without environment variables.');
  console.warn('\x1b[33m%s\x1b[0m', 'Create a .env file with GOOGLE_CLIENT_ID, JWT_SECRET, etc.');
} else {
  console.log('\x1b[32m%s\x1b[0m', '.env file found in project root');
  
  // Load environment variables from .env file
  require('dotenv').config();
}

// Load configuration and set up environment
const configManager = require('./config');
configManager.setupEnv();

// No need to start a local server as we're using a remote server

// Handle external URLs
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        
        // Allow navigation to localhost
        if (parsedUrl.hostname === 'localhost') {
            return;
        }
        
        // For all other URLs, open in external browser
        event.preventDefault();
        shell.openExternal(navigationUrl);
    });
    
    contents.setWindowOpenHandler(({ url }) => {
        // Open all external links in the default browser
        shell.openExternal(url);
        return { action: 'deny' };
    });
});

// Handle window resize requests from renderer
ipcMain.on('resize-window', (event, size) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth } = primaryDisplay.workAreaSize;
        
        // Always position at the right edge of the screen
        win.setBounds({
            width: size.width,
            height: size.height,
            x: screenWidth - size.width,
            y: win.getBounds().y
        });
    }
});

// Handle screenshot capture requests from renderer
ipcMain.on('capture-screenshot', async (event) => {
    try {
        console.log('Main process: Capturing screenshot...');
        
        // Get all available sources
        const sources = await desktopCapturer.getSources({ 
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 }
        });

        // Use the primary display (first source)
        const primarySource = sources[0];
        
        if (!primarySource) {
            event.reply('screenshot-captured', 'No screen source found', null);
            return;
        }

        // Get the thumbnail as a data URL
        const thumbnail = primarySource.thumbnail.toDataURL();
        
        // Convert data URL to base64 string (remove the prefix)
        const base64Data = thumbnail.replace(/^data:image\/png;base64,/, '');
        
        // Send the base64 data back to the renderer
        event.reply('screenshot-captured', null, base64Data);
    } catch (error) {
        console.error('Error capturing screenshot in main process:', error);
        event.reply('screenshot-captured', error.message, null);
    }
});

function createWindow() {
    
    const mainWindow = new BrowserWindow({
        width: 350,  // Width for the menu
        height: 600, // Height for the app
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        // Add these properties to ensure it stays on top of fullscreen apps
        focusable: true, 
        skipTaskbar: true,
        // This is the key property for staying on top of fullscreen apps
        type: 'panel', // Use 'toolbar' on Windows, 'panel' on macOS
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            // Add this line to allow playing audio from blob URLs
            webviewTag: true
        },
        resizable: false,
        fullscreenable: false
    });
    
    // Set the window level to be above fullscreen apps (macOS specific)
    if (process.platform === 'darwin') {
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    } else {
        // For Windows, set a higher level of always-on-top
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }

    // Position the window at the right edge of the screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    mainWindow.setPosition(width - 350, Math.floor(height / 2) - 300);
    
    // Add event handlers to ensure the window stays on top when shown or focused
    mainWindow.on('show', () => {
        // Re-apply always-on-top setting when window is shown
        if (process.platform === 'darwin') {
            mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        } else {
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
        }
    });
    
    mainWindow.on('focus', () => {
        // Re-apply always-on-top setting when window is focused
        if (process.platform === 'darwin') {
            mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        } else {
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
        }
    });
    
    // Use the correct path to index.html
    const indexPath = getAssetPath('index.html');
    console.log('Loading HTML from:', indexPath);
    
    // Check if the file exists
    if (!fs.existsSync(indexPath)) {
        console.error('index.html not found at:', indexPath);
        
        // Show error dialog
        dialog.showErrorBox('DUOAI Error', 
            `Could not find index.html at: ${indexPath}\n\n` +
            `This is likely due to a packaging issue. Please reinstall the application.`);
        
        app.quit();
        return;
    }
    
    // Set Content Security Policy before loading the page
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        // Get the API URL from config
        const apiUrl = configManager.loadConfig().API_URL || 'https://duoai.vercel.app';
        
        // Create CSP with dynamic API URL and explicitly include production URL
        // Add media-src 'self' blob: to allow blob URLs for audio playback
        const csp = `default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://api.anthropic.com https://api.elevenlabs.io https://api.openai.com ${apiUrl} https://duoai.vercel.app http://localhost:3000; img-src 'self' data:; style-src 'self' 'unsafe-inline'; media-src 'self' blob:;`;
        
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp]
            }
        });
    });
    
    mainWindow.loadFile(indexPath);
    
    // Allow the window to be moved during login
    mainWindow.setMovable(true);
    
    // Open DevTools for debugging in development mode only
    if (isDev) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
}

// Function to detect fullscreen applications
function checkForFullscreenApps() {
    if (process.platform === 'win32') {
        try {
            // On Windows, we can use the screen API to detect fullscreen apps
            const displays = screen.getAllDisplays();
            let hasFullscreenApp = false;
            
            for (const display of displays) {
                // Check if any display has a fullscreen app
                if (display.workArea.width !== display.bounds.width || 
                    display.workArea.height !== display.bounds.height) {
                    hasFullscreenApp = true;
                    break;
                }
            }
            
            // If a fullscreen app is detected, ensure our window stays on top
            const mainWindow = BrowserWindow.getAllWindows()[0];
            if (hasFullscreenApp && mainWindow) {
                mainWindow.setAlwaysOnTop(true, 'screen-saver');
            }
        } catch (error) {
            console.error('Error checking for fullscreen apps:', error);
        }
    }
}

app.whenReady().then(() => {
    // Check dependencies before proceeding
    if (!checkDependencies()) {
        app.quit();
        return;
    }
    
    // Protocol handler registration removed
    
    createWindow();
    
    // Check for fullscreen apps periodically
    setInterval(checkForFullscreenApps, 2000); // Check every 2 seconds
    
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Protocol URL handling
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('duoai', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('duoai');
}

// Windows protocol handler
if (process.platform === 'win32') {
  // Handle the protocol on Windows
  const gotTheLock = app.requestSingleInstanceLock();
  
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // Someone tried to run a second instance, we should focus our window.
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        
        // Protocol handling
        const url = commandLine.pop();
        if (url && url.startsWith('duoai://')) {
          handleProtocolUrl(url);
        }
      }
    });
    
    // Handle protocol for app launch
    app.on('open-url', (event, url) => {
      event.preventDefault();
      handleProtocolUrl(url);
    });
  }
}

// Function to handle protocol URLs
function handleProtocolUrl(url) {
  console.log('Protocol URL received:', url);
  
  try {
    // Parse the URL
    const parsedUrl = new URL(url);
    
    // Get the main window
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return;
    
    // Handle different protocol actions
    if (parsedUrl.hostname === 'launch') {
      // Just focus the window
      mainWindow.show();
      mainWindow.focus();
    } else if (parsedUrl.hostname === 'character') {
      // Select a specific character
      const character = parsedUrl.pathname.substring(1);
      if (character) {
        mainWindow.webContents.send('select-character', character);
      }
    } else if (parsedUrl.hostname === 'screenshot') {
      // Trigger a screenshot
      mainWindow.webContents.send('trigger-screenshot');
    }
  } catch (error) {
    console.error('Error handling protocol URL:', error);
  }
}

// Add this IPC handler for audio playback
ipcMain.on('keep-app-running', (event, keepRunning) => {
    audioPlaybackActive = keepRunning;
    
    if (keepRunning) {
        // Start power save blocker if not already active
        if (powerSaveBlockerId === null) {
            powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
            console.log('Power save blocker started with ID:', powerSaveBlockerId);
        }
    } else {
        // Stop power save blocker if active
        if (powerSaveBlockerId !== null) {
            powerSaveBlocker.stop(powerSaveBlockerId);
            console.log('Power save blocker stopped');
            powerSaveBlockerId = null;
        }
    }
});

// Add these imports at the top of main.js if not already present

// Handle audio playback in the main process to bypass CSP restrictions
ipcMain.on('play-audio-file', (event, data) => {
    try {
        console.log('Main process received audio playback request');
        
        // Create a temporary file for the audio
        const tempFilePath = path.join(os.tmpdir(), `duoai-audio-${Date.now()}.mp3`);
        
        // Convert array back to Buffer
        const buffer = Buffer.from(data.buffer);
        
        // Write the buffer to a temporary file
        fs.writeFileSync(tempFilePath, buffer);
        console.log('Wrote audio data to temporary file:', tempFilePath);
        
        // Create a hidden browser window to play the audio
        const audioWindow = new BrowserWindow({
            width: 1,
            height: 1,
            show: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        
        // Create a simple HTML content with an audio player
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Audio Player</title>
            </head>
            <body>
                <audio id="player" autoplay>
                    <source src="file://${tempFilePath}" type="audio/mpeg">
                </audio>
                <script>
                    const { ipcRenderer } = require('electron');
                    const player = document.getElementById('player');
                    
                    // Set volume
                    player.volume = ${data.volume || 0.5};
                    
                    // When audio ends, notify main process
                    player.onended = () => {
                        ipcRenderer.send('audio-playback-complete');
                    };
                    
                    // If there's an error, also notify
                    player.onerror = (e) => {
                        console.error('Error playing audio:', e);
                        ipcRenderer.send('audio-playback-complete');
                    };
                </script>
            </body>
            </html>
        `;
        
        // Load the HTML content
        audioWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
        
        // Start power save blocker if not already active
        let tempPowerSaveBlockerId = null;
        if (powerSaveBlockerId === null) {
            tempPowerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
            console.log('Temporary power save blocker started for audio playback with ID:', tempPowerSaveBlockerId);
        }
        
        // Listen for playback complete
        ipcMain.once('audio-playback-complete', () => {
            console.log('Audio playback complete, cleaning up');
            
            // Clean up temporary file
            try {
                fs.unlinkSync(tempFilePath);
                console.log('Removed temporary audio file');
            } catch (e) {
                console.warn('Error removing temporary audio file:', e);
            }
            
            // Stop temporary power save blocker if we created one
            if (tempPowerSaveBlockerId !== null) {
                powerSaveBlocker.stop(tempPowerSaveBlockerId);
                console.log('Stopped temporary power save blocker');
            }
            
            // Close the window
            audioWindow.close();
            
            // Notify the renderer
            event.sender.send('audio-playback-complete');
        });
        
        // Set a timeout in case the audio doesn't play or end properly
        setTimeout(() => {
            // Check if the window still exists
            if (!audioWindow.isDestroyed()) {
                console.log('Audio playback timeout reached, cleaning up');
                
                // Clean up temporary file
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (e) {
                    // Ignore errors during cleanup
                }
                
                // Stop temporary power save blocker if we created one
                if (tempPowerSaveBlockerId !== null) {
                    powerSaveBlocker.stop(tempPowerSaveBlockerId);
                }
                
                // Close the window
                audioWindow.close();
                
                // Notify the renderer
                event.sender.send('audio-playback-complete');
            }
        }, 30000); // 30 second timeout
    } catch (error) {
        console.error('Error playing audio in main process:', error);
        event.sender.send('audio-playback-complete'); // Notify anyway to prevent hanging
    }
});

app.on('window-all-closed', function () {
    // Don't quit if audio is playing
    if (audioPlaybackActive) {
        console.log('Window closed but audio is playing, keeping app running');
        return;
    }
    
    // Otherwise quit on all platforms except macOS
    if (process.platform !== 'darwin') app.quit();
});

// Add this to handle app before-quit event
app.on('before-quit', () => {
    // Make sure to stop power save blocker if active
    if (powerSaveBlockerId !== null) {
        powerSaveBlocker.stop(powerSaveBlockerId);
        powerSaveBlockerId = null;
    }
});

// No need to clean up server process as we're using a remote server

// Handle opening external URLs
ipcMain.on('open-external-url', (event, url) => {
    shell.openExternal(url);
});

// IPC handlers for settings
ipcMain.handle('get-config', async () => {
    return configManager.loadConfig();
});

ipcMain.handle('save-config', async (event, newConfig) => {
    const result = configManager.saveConfig(newConfig);
    return result;
});
