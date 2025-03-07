const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

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

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 50,  // Just enough width for the pull tab initially
        height: 600,
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

    // Position the window at the right edge of the screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    mainWindow.setPosition(width - 50, Math.floor(height / 2) - 300);
    
    mainWindow.loadFile('index.html');
    
    // Prevent the window from being moved by the user
    mainWindow.setMovable(false);
    
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
