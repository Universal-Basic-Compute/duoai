const { app, BrowserWindow, ipcMain, screen, desktopCapturer, shell, protocol, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

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
    // In development, resources are in the project root
    return path.join(__dirname, ...paths);
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
        const csp = `default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com https://*.googleapis.com; connect-src 'self' https://api.anthropic.com https://api.elevenlabs.io https://api.openai.com ${apiUrl} https://duoai.vercel.app https://*.googleapis.com https://accounts.google.com http://localhost:3000; img-src 'self' data: https://*.googleusercontent.com; style-src 'self' 'unsafe-inline';`;
        
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
    // Check dependencies before proceeding
    if (!checkDependencies()) {
        app.quit();
        return;
    }
    
    // Register custom protocol handler
    if (process.platform === 'win32') {
        app.setAsDefaultProtocolClient('duoai');
    } else {
        app.setAsDefaultProtocolClient('duoai', process.execPath, [path.resolve(process.argv[1] || '.')]);
    }
    
    createWindow();
    
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Add this to handle protocol activation
app.on('open-url', (event, url) => {
    event.preventDefault();
    
    // Parse the URL
    if (url.startsWith('duoai://auth')) {
        const dataStr = decodeURIComponent(url.substring(12));
        try {
            const authData = JSON.parse(dataStr);
            // Send to renderer process
            const win = BrowserWindow.getAllWindows()[0];
            if (win) {
                win.webContents.send('auth-data-received', authData);
            }
        } catch (error) {
            console.error('Error parsing auth data:', error);
        }
    }
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
