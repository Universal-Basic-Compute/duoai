const { contextBridge, desktopCapturer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSources: async () => {
    try {
      console.log('Getting screen sources from preload script');
      const sources = await desktopCapturer.getSources({ 
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 } // Don't need thumbnails
      });
      console.log('Screen sources:', sources.map(s => s.id));
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
