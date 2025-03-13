const { contextBridge, desktopCapturer, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the desktopCapturer without exposing the entire Electron API
contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSources: async () => {
    try {
      console.log('Getting screen sources from preload script');
      // Use the desktopCapturer directly in the preload script
      const sources = await desktopCapturer.getSources({ 
        types: ['screen', 'window'],
        thumbnailSize: { width: 1, height: 1 } // Minimal thumbnails
      });
      console.log('Screen sources found:', sources.length);
      // Return a simplified version of the sources to avoid exposing too much
      return sources.map(source => ({
        id: source.id,
        name: source.name,
        displayId: source.display_id,
        type: source.id.includes('screen') ? 'screen' : 'window'
      }));
    } catch (error) {
      console.error('Error getting screen sources in preload:', error);
      return [];
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload script loaded');
});
