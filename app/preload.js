const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSources: async () => {
    try {
      console.log('Getting screen sources via IPC');
      return await ipcRenderer.invoke('get-screen-sources');
    } catch (error) {
      console.error('Error getting screen sources via IPC:', error);
      return [];
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload script loaded');
});
