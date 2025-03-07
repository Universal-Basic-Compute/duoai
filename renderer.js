document.addEventListener('DOMContentLoaded', () => {
    const menuTab = document.getElementById('menuTab');
    const sideMenu = document.getElementById('sideMenu');
    const startButton = document.getElementById('startButton');
    
    let menuOpen = false;
    
    // Get electron API
    const { ipcRenderer } = require('electron');
    const systemPromptBuilder = require('./system_prompt_builder');
    
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
    
    // Characters button functionality
    const charactersButton = document.getElementById('charactersButton');
    const charactersSubmenu = document.getElementById('charactersSubmenu');
    const backButton = document.getElementById('backButton');

    charactersButton.addEventListener('click', () => {
        // Show the characters submenu
        charactersSubmenu.style.right = '0';
    });

    backButton.addEventListener('click', () => {
        // Hide the characters submenu
        charactersSubmenu.style.right = '-300px';
    });
    
    // Add click event listeners to character items
    document.querySelectorAll('.character-item').forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all items
            document.querySelectorAll('.character-item').forEach(i => {
                i.classList.remove('character-active');
            });
            
            // Add active class to clicked item
            item.classList.add('character-active');
            
            // Get character name
            const characterName = item.querySelector('.character-name').textContent;
            console.log(`Selected character: ${characterName}`);
            
            // Build the system prompt for the selected character
            const systemPrompt = systemPromptBuilder.buildSystemPrompt(characterName);
            console.log('System prompt built successfully');
            
            // Store the system prompt for later use
            localStorage.setItem('currentSystemPrompt', systemPrompt);
            localStorage.setItem('currentCharacter', characterName);
            
            // Optional: Close the submenu after selection
            // charactersSubmenu.style.right = '-300px';
        });
    });
});
