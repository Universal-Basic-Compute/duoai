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
    
    console.log('Menu tab element:', menuTab);
    menuTab.style.pointerEvents = 'auto';
    
    let menuOpen = false;
    let currentCharacter = null;
    
    // Get electron API
    const { ipcRenderer } = require('electron');
    const systemPromptBuilder = require('./system_prompt_builder');
    const screenshotUtil = require('./screenshot');
    const claudeAPI = require('./claude_api');
    
    
    // Ensure menu tab is in the correct position at startup
    menuTab.style.right = '0';
    
    // Toggle menu when clicking on the tab
    menuTab.addEventListener('click', (event) => {
        // Prevent any default behavior or event propagation issues
        event.preventDefault();
        event.stopPropagation();
        
        console.log('Menu tab clicked, current state:', menuOpen);
        
        // First, ensure chat container is hidden if we're opening the menu
        if (!menuOpen) {
            chatContainer.style.right = '-350px';
        }
        
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
        
        console.log('Menu state after click:', menuOpen);
    });
    
    // Start button functionality
    startButton.addEventListener('click', async () => {
        // Check if a character is selected
        currentCharacter = localStorage.getItem('currentCharacter');
        if (!currentCharacter) {
            alert('Please select a character first');
            return;
        }
        
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
        
        try {
            // Capture screenshot
            const screenshotPath = await screenshotUtil.captureScreenshot();
            
            // Get system prompt
            const systemPrompt = localStorage.getItem('currentSystemPrompt');
            
            // Call Claude API
            const response = await claudeAPI.sendMessageWithScreenshot(
                systemPrompt,
                "I just started the app. What do you see in this screenshot? Can you provide any gaming advice based on what you see?",
                screenshotPath
            );
            
            // Remove loading indicator
            removeLoadingIndicator();
            
            // Add AI message to chat
            addMessage(response, 'ai');
            
            // Clean up old screenshots
            screenshotUtil.cleanupOldScreenshots();
        } catch (error) {
            console.error('Error starting chat:', error);
            
            // Remove loading indicator
            removeLoadingIndicator();
            
            // Show error message
            addMessage("I'm sorry, I encountered an error. Please try again later.", 'ai');
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
