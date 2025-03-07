const { app, BrowserWindow, ipcMain, screen, desktopCapturer, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Start the Express server
let serverProcess = null;

function startServer() {
    serverProcess = spawn('node', ['server.js'], {
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
        width: 350,  // Wider initially to show login
        height: 500,
        frame: false,  // Remove window frame
        transparent: true,  // Make window background transparent
        alwaysOnTop: true,  // Always on top of other windows
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        // Add these properties
        resizable: false,
        fullscreenable: false,
        skipTaskbar: true
    });

    // Position the window at the center of the screen initially
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    mainWindow.setPosition(Math.floor(width / 2) - 175, Math.floor(height / 2) - 250);
    
    mainWindow.loadFile('index.html');
    
    // Allow the window to be moved during login
    mainWindow.setMovable(true);
    
    // Open DevTools for debugging
    mainWindow.webContents.openDevTools({ mode: 'detach' });
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
