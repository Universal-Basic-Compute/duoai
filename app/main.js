const { app, BrowserWindow, Menu, MenuItem, ipcMain, desktopCapturer, screen } = require('electron')
const path = require('path')

// Add IPC handler for screen capture
ipcMain.handle('get-screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({ 
      types: ['screen', 'window'],
      thumbnailSize: { width: 1, height: 1 }
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      displayId: source.display_id,
      type: source.id.includes('screen') ? 'screen' : 'window'
    }));
  } catch (error) {
    console.error('Error getting screen sources:', error);
    return [];
  }
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 350,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // These are important for screen capture
      enableRemoteModule: false,
      webSecurity: true
    }
  })

  // Remove the default menu bar
  mainWindow.setMenu(null)

  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  // Set window width to be narrower (350px)
  const windowWidth = 350

  // Position the window at the right edge of the screen
  mainWindow.setBounds({
    width: windowWidth,
    height: height,
    x: width - windowWidth,
    y: 0
  })

  // Make the window always on top
  mainWindow.setAlwaysOnTop(true, 'floating')

  // Set permissions for media access
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      // Allow media access (microphone, camera, screen)
      callback(true);
    } else {
      callback(false);
    }
  });

  // Set permissions for media access
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      // Allow media access (microphone, camera, screen)
      callback(true);
    } else {
      callback(false);
    }
  });

  mainWindow.loadFile('index.html')
  
  // Create a context menu
  const contextMenu = new Menu()
  contextMenu.append(new MenuItem({
    label: 'Inspect Element',
    click: () => {
      mainWindow.webContents.inspectElement(rightClickPosition.x, rightClickPosition.y)
    }
  }))
  
  contextMenu.append(new MenuItem({
    label: 'Open Developer Tools',
    click: () => {
      mainWindow.webContents.openDevTools()
    }
  }))

  // Track the position of right-click
  let rightClickPosition = { x: 0, y: 0 }
  
  // Listen for right-click events
  mainWindow.webContents.on('context-menu', (event, params) => {
    rightClickPosition = { x: params.x, y: params.y }
    contextMenu.popup()
  })
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})
