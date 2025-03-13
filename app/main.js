const { app, BrowserWindow, Menu, MenuItem } = require('electron')
const path = require('path')

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // Add these permissions for screen capture
      enableRemoteModule: false,
      webSecurity: true
    }
  })

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
