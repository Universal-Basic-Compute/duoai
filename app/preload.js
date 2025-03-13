const { contextBridge, desktopCapturer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSources: async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      return sources;
    } catch (error) {
      console.error('Error getting screen sources:', error);
      return [];
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload script loaded');
});
