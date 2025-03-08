const { app, BrowserWindow, ipcMain, screen, desktopCapturer, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

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
  return path.join(app.isPackaged ? process.resourcesPath : __dirname, ...paths);
}

// Add fs module for file existence checks
const fs = require('fs');

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
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        resizable: false,
        fullscreenable: false,
        skipTaskbar: true
    });

    // Position the window at the right edge of the screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    mainWindow.setPosition(width - 350, Math.floor(height / 2) - 300);
    
    // Use the correct path to index.html
    const indexPath = getAssetPath('index.html');
    console.log('Loading HTML from:', indexPath);
    
    // Check if the file exists
    if (!fs.existsSync(indexPath)) {
        console.error('index.html not found at:', indexPath);
    }
    
    // Set Content Security Policy before loading the page
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        // Get the API URL from config
        const apiUrl = configManager.loadConfig().API_URL || 'https://duoai.vercel.app';
        
        // Create CSP with dynamic API URL
        const csp = `default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com https://*.googleapis.com; connect-src 'self' https://api.anthropic.com https://api.elevenlabs.io https://api.openai.com ${apiUrl} https://*.googleapis.com https://accounts.google.com http://localhost:3000; img-src 'self' data: https://*.googleusercontent.com; style-src 'self' 'unsafe-inline';`;
        
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

app.whenReady().then(() => {
    createWindow();
    
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// No need to clean up server process as we're using a remote server

// Handle opening external URLs
ipcMain.on('open-external-url', (event, url) => {
    shell.openExternal(url);
});

// Settings window
let settingsWindow = null;

function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }
    
    settingsWindow = new BrowserWindow({
        width: 600,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        parent: BrowserWindow.getFocusedWindow(),
        modal: true,
        show: false
    });
    
    settingsWindow.loadFile(getAssetPath('settings.html'));
    
    settingsWindow.once('ready-to-show', () => {
        settingsWindow.show();
    });
    
    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

// IPC handlers for settings
ipcMain.handle('get-config', async () => {
    return configManager.loadConfig();
});

ipcMain.handle('save-config', async (event, newConfig) => {
    const result = configManager.saveConfig(newConfig);
    return result;
});

ipcMain.on('close-settings', () => {
    if (settingsWindow) {
        settingsWindow.close();
    }
});

// Add menu item for settings
ipcMain.on('open-settings', () => {
    createSettingsWindow();
});
