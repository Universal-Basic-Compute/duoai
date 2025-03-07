const { app, BrowserWindow, ipcMain, screen, desktopCapturer, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Environment variables
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const isMac = process.platform === 'darwin';

// Helper function to get asset paths
function getAssetPath(...paths) {
  return path.join(app.isPackaged ? process.resourcesPath : __dirname, ...paths);
}

// Start the Express server
let serverProcess = null;

function startServer() {
    let serverPath;
    let serverArgs;
    
    if (app.isPackaged) {
        // Use the packaged server executable
        const platform = process.platform;
        const extension = platform === 'win32' ? '.exe' : '';
        serverPath = path.join(process.resourcesPath, 'server', `duoai-server${extension}`);
        serverArgs = [];
    } else {
        // Use Node.js to run the server script in development
        serverPath = 'node';
        serverArgs = ['server.js'];
    }
    
    serverProcess = spawn(serverPath, serverArgs, {
        stdio: 'inherit',
        detached: false
    });
    
    console.log('Server started with PID:', serverProcess.pid);
    
    serverProcess.on('error', (err) => {
        console.error('Failed to start server:', err);
    });
    
    serverProcess.on('exit', (code, signal) => {
        console.log(`Server process exited with code ${code} and signal ${signal}`);
        serverProcess = null;
    });
}

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
    // Start the server if it's not already running
    if (!serverProcess) {
        startServer();
    }
    
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
    
    mainWindow.loadFile(getAssetPath('index.html'));
    
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

// Clean up the server process when the app quits
app.on('will-quit', () => {
    if (serverProcess) {
        console.log('Killing server process');
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
        } else {
            serverProcess.kill();
        }
        serverProcess = null;
    }
});

// Handle opening external URLs
ipcMain.on('open-external-url', (event, url) => {
    shell.openExternal(url);
});

// Load and save configuration
const configManager = require('./config');

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
    
    // Restart the server to apply new settings
    if (result && serverProcess) {
        if (serverProcess) {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
            } else {
                serverProcess.kill();
            }
            serverProcess = null;
        }
        
        // Start the server with new config
        startServer();
    }
    
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
