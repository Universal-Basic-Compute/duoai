document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');
    
    const menuTab = document.getElementById('menuTab');
    const sideMenu = document.getElementById('sideMenu');
    const startButton = document.getElementById('startButton');
    const chatContainer = document.getElementById('chatContainer');
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const closeChatButton = document.getElementById('closeChatButton');
    const selectedCharacter = document.getElementById('selectedCharacter');
    const loginContainer = document.getElementById('loginContainer');
    const googleLoginButton = document.getElementById('googleLoginButton');
    const logoutButton = document.getElementById('logoutButton');
    let isLoggedIn = false; // Track login state
    
    // Select Nova by default
    const selectDefaultCharacter = () => {
        // Find the Nova character item
        const novaCharacterItem = Array.from(document.querySelectorAll('.character-item'))
            .find(item => item.querySelector('.character-name').textContent === 'Nova');
        
        if (novaCharacterItem) {
            console.log('Selecting Nova by default');
            
            // Add active class
            novaCharacterItem.classList.add('character-active');
            
            // Build the system prompt for Nova
            const systemPrompt = systemPromptBuilder.buildSystemPrompt('Nova');
            console.log('Default system prompt built for Nova');
            
            // Store the system prompt for later use
            localStorage.setItem('currentSystemPrompt', systemPrompt);
            localStorage.setItem('currentCharacter', 'Nova');
            
            // Set current character
            currentCharacter = 'Nova';
        }
    };
    
    console.log('Menu tab found:', menuTab !== null);
    if (menuTab === null) {
        console.error('Menu tab element not found!');
    }
    
    console.log('Menu tab element:', menuTab);
    
    // Apply direct styles to ensure clickability
    menuTab.style.pointerEvents = 'auto';
    menuTab.style.cursor = 'pointer';
    menuTab.style.zIndex = '9999';
    
    let menuOpen = false;
    let currentCharacter = null;
    
    // Get electron API
    const { ipcRenderer } = require('electron');
    const systemPromptBuilder = require('./system_prompt_builder');
    const screenshotUtil = require('./screenshot');
    const claudeAPI = require('./claude_api');
    
    // Function to check login state
    function checkLoginState() {
        // For now, we'll use localStorage to simulate login state
        // In a real app, you would check with your authentication service
        isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        
        if (isLoggedIn) {
            // User is logged in, hide login container and show app
            loginContainer.classList.add('hidden');
            menuTab.style.display = 'block';
        } else {
            // User is not logged in, show login container and hide app
            loginContainer.classList.remove('hidden');
            menuTab.style.display = 'none';
        }
    }
    
    // Hide menu tab initially
    menuTab.style.display = 'none';
    
    // Call the function to select Nova by default
    selectDefaultCharacter();
    
    // Ensure menu tab is in the correct position at startup
    menuTab.style.right = '0';
    
    // Remove any existing event listeners
    menuTab.removeEventListener('click', null);
    
    // Define a named function for better debugging
    function handleMenuTabClick(event) {
        console.log('Menu tab clicked!');
        
        // Toggle menu state
        if (menuOpen) {
            // Hide menu
            sideMenu.style.right = '-300px';
            menuTab.style.right = '0';
            // Resize window to be narrow when menu is closed
            ipcRenderer.send('resize-window', { width: 50, height: 600 });
            menuOpen = false;
        } else {
            // Show menu
            sideMenu.style.right = '0';
            menuTab.style.right = '300px';
            // Hide chat if it's open
            chatContainer.style.right = '-350px';
            // Resize window to accommodate the open menu
            ipcRenderer.send('resize-window', { width: 350, height: 600 });
            menuOpen = true;
        }
        
        console.log('Menu state after click:', menuOpen);
    }
    
    // Add the click event listener
    menuTab.addEventListener('click', handleMenuTabClick);
    
    // Also add a mousedown event for better responsiveness
    menuTab.addEventListener('mousedown', function(event) {
        console.log('Mouse down on menu tab');
    });
    
    // Start button functionality
    startButton.addEventListener('click', async () => {
        console.log('Start button clicked');
        
        try {
            // Check if a character is selected
            currentCharacter = localStorage.getItem('currentCharacter');
            if (!currentCharacter) {
                alert('Please select a character first');
                return;
            }
            
            console.log(`Using character: ${currentCharacter}`);
            
            // Update the character info in the chat header
            selectedCharacter.innerHTML = `
                <div class="character-avatar">${currentCharacter.charAt(0)}</div>
                <div class="character-info">${currentCharacter}</div>
            `;
            
            // Clear previous messages
            chatMessages.innerHTML = '';
            
            // Show the chat container
            chatContainer.style.right = '0';
            
            // Hide the side menu
            sideMenu.style.right = '-300px';
            menuTab.style.right = '350px';
            
            // Resize window to accommodate the chat
            ipcRenderer.send('resize-window', { width: 350, height: 600 });
            
            // Show loading indicator
            addLoadingIndicator();
            
            // Get system prompt
            const systemPrompt = localStorage.getItem('currentSystemPrompt');
            console.log('System prompt retrieved:', systemPrompt ? 'Yes' : 'No');
            
            try {
                // Capture screenshot
                console.log('Capturing screenshot...');
                const screenshotPath = await screenshotUtil.captureScreenshot();
                console.log('Screenshot captured:', screenshotPath);
                
                // Call Claude API
                console.log('Sending message to Claude API...');
                const response = await claudeAPI.sendMessageWithScreenshot(
                    systemPrompt,
                    "I just started the app. What do you see in this screenshot? Can you provide any gaming advice based on what you see?",
                    screenshotPath
                );
                
                console.log('Received response from Claude API');
                
                // Remove loading indicator
                removeLoadingIndicator();
                
                // Add AI message to chat
                addMessage(response, 'ai');
                
                // Clean up old screenshots
                screenshotUtil.cleanupOldScreenshots();
            } catch (error) {
                console.error('Error in API call or screenshot:', error);
                
                // Remove loading indicator
                removeLoadingIndicator();
                
                // Show error message with details
                const errorMessage = `I'm sorry, I encountered an error: ${error.message}. Please make sure the backend server is running.`;
                addMessage(errorMessage, 'ai');
            }
        } catch (error) {
            console.error('Unexpected error in start button handler:', error);
            alert(`An unexpected error occurred: ${error.message}`);
        }
    });
    
    // Close chat button functionality
    closeChatButton.addEventListener('click', () => {
        // Hide the chat container
        chatContainer.style.right = '-350px';
        
        // Show the menu tab
        menuTab.style.right = '0';
        
        // Resize window
        ipcRenderer.send('resize-window', { width: 50, height: 600 });
    });
    
    // Send button functionality
    sendButton.addEventListener('click', () => {
        sendMessage();
    });
    
    // Send message on Enter key (but allow Shift+Enter for new lines)
    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
    
    // Auto-resize textarea as user types
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    });
    
    // Function to send a message
    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        addMessage(message, 'user');
        
        // Clear input
        userInput.value = '';
        userInput.style.height = 'auto';
        
        // Show loading indicator
        addLoadingIndicator();
        
        try {
            // Capture screenshot
            const screenshotPath = await screenshotUtil.captureScreenshot();
            
            // Get system prompt
            const systemPrompt = localStorage.getItem('currentSystemPrompt');
            
            // Call Claude API
            const response = await claudeAPI.sendMessageWithScreenshot(
                systemPrompt,
                message,
                screenshotPath
            );
            
            // Remove loading indicator
            removeLoadingIndicator();
            
            // Add AI message to chat
            addMessage(response, 'ai');
            
            // Clean up old screenshots
            screenshotUtil.cleanupOldScreenshots();
        } catch (error) {
            console.error('Error sending message:', error);
            
            // Remove loading indicator
            removeLoadingIndicator();
            
            // Show error message
            addMessage("I'm sorry, I encountered an error. Please try again later.", 'ai');
        }
    }
    
    // Function to add a message to the chat
    function addMessage(text, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to add loading indicator
    function addLoadingIndicator() {
        const loadingElement = document.createElement('div');
        loadingElement.classList.add('loading-indicator');
        loadingElement.innerHTML = `
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
        `;
        loadingElement.id = 'loadingIndicator';
        chatMessages.appendChild(loadingElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to remove loading indicator
    function removeLoadingIndicator() {
        const loadingElement = document.getElementById('loadingIndicator');
        if (loadingElement) {
            loadingElement.remove();
        }
    }
    
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
    
    // Add event listener for Google login button
    googleLoginButton.addEventListener('click', () => {
        console.log('Google login button clicked');
        
        // In a real app, you would implement Google OAuth here
        // For now, we'll simulate a successful login
        localStorage.setItem('isLoggedIn', 'true');
        isLoggedIn = true;
        
        // Update UI
        loginContainer.classList.add('hidden');
        menuTab.style.display = 'block';
        
        // Resize window to show the menu tab
        ipcRenderer.send('resize-window', { width: 50, height: 600 });
    });
    
    // Logout function
    function logout() {
        localStorage.setItem('isLoggedIn', 'false');
        isLoggedIn = false;
        
        // Update UI
        loginContainer.classList.remove('hidden');
        menuTab.style.display = 'none';
        
        // Hide other containers
        sideMenu.style.right = '-300px';
        chatContainer.style.right = '-350px';
        
        // Resize window to show login
        ipcRenderer.send('resize-window', { width: 350, height: 500 });
    }
    
    // Add event listener for logout button
    logoutButton.addEventListener('click', logout);
    
    // Check login state at startup
    checkLoginState();
    
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
