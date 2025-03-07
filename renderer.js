document.addEventListener('DOMContentLoaded', () => {
    const menuTab = document.getElementById('menuTab');
    const sideMenu = document.getElementById('sideMenu');
    const startButton = document.getElementById('startButton');
    
    let menuOpen = false;
    
    // Get electron API
    const { ipcRenderer } = require('electron');
    
    // Toggle menu when clicking on the tab
    menuTab.addEventListener('click', () => {
        if (menuOpen) {
            sideMenu.style.right = '-300px';
            menuTab.style.right = '0';
            // Resize window to be narrow when menu is closed
            ipcRenderer.send('resize-window', { width: 50, height: 600 });
        } else {
            sideMenu.style.right = '0';
            menuTab.style.right = '300px';
            // Resize window to accommodate the open menu
            ipcRenderer.send('resize-window', { width: 350, height: 600 });
        }
        menuOpen = !menuOpen;
    });
    
    // Start button functionality
    startButton.addEventListener('click', () => {
        console.log('DuoAI started!');
        // Add your start functionality here
    });
});
