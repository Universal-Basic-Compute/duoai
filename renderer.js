document.addEventListener('DOMContentLoaded', () => {
    const menuTab = document.getElementById('menuTab');
    const sideMenu = document.getElementById('sideMenu');
    const startButton = document.getElementById('startButton');
    
    let menuOpen = false;
    
    // Toggle menu when clicking on the tab
    menuTab.addEventListener('click', () => {
        if (menuOpen) {
            sideMenu.style.right = '-300px';
            menuTab.style.right = '0';
        } else {
            sideMenu.style.right = '0';
            menuTab.style.right = '300px';
        }
        menuOpen = !menuOpen;
    });
    
    // Start button functionality
    startButton.addEventListener('click', () => {
        console.log('DuoAI started!');
        // Add your start functionality here
    });
});
