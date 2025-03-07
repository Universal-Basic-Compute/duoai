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
    const volumeSlider = document.getElementById('volumeSlider');
    const micButton = document.getElementById('micButton');
    const speechStatus = document.getElementById('speechStatus');
    const voiceSelector = document.getElementById('voiceSelector');
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
    const authBridge = require('./bridge');
    const speechManager = require('./speech');
    
    // Add offline support utilities
    const responseCache = new Map();
    
    // Check for network connectivity
    function isOnline() {
        return navigator.onLine;
    }
    
    // Cache important responses
    function cacheResponse(key, data) {
        responseCache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        // Also store in localStorage for persistence
        try {
            localStorage.setItem(`cache_${key}`, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to cache in localStorage:', e);
        }
    }
    
    // Get cached response
    function getCachedResponse(key, maxAgeMs = 24 * 60 * 60 * 1000) { // Default 24 hours
        // Try memory cache first
        const memoryCache = responseCache.get(key);
        if (memoryCache && (Date.now() - memoryCache.timestamp < maxAgeMs)) {
            return memoryCache.data;
        }
        
        // Try localStorage
        try {
            const storedCache = localStorage.getItem(`cache_${key}`);
            if (storedCache) {
                const parsed = JSON.parse(storedCache);
                if (Date.now() - parsed.timestamp < maxAgeMs) {
                    // Refresh memory cache
                    responseCache.set(key, parsed);
                    return parsed.data;
                }
            }
        } catch (e) {
            console.warn('Failed to retrieve from localStorage:', e);
        }
        
        return null;
    }

    // Add these variables at the top of the file
    let activeSessionId = null;
    let isSubscriptionActive = false;

    // Function to check authentication status with the server
    async function checkServerAuthStatus() {
        try {
            const authStatus = await authBridge.checkAuthStatus();
        
            if (authStatus.isAuthenticated) {
                // User is logged in
                console.log('Logged in as:', authStatus.user.name);
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('user', JSON.stringify(authStatus.user));
            
                // Check subscription status
                await checkSubscriptionStatus();
            
                return true;
            } else {
                // User is not logged in
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('user');
                return false;
            }
        } catch (error) {
            console.error('Error checking authentication status:', error);
            return false;
        }
    }

    // Function to check subscription status
    async function checkSubscriptionStatus() {
        // For testing, always return true
        isSubscriptionActive = true;
        return true;
    }

    // Start tracking usage when chat is opened
    async function startUsageTracking() {
        // For testing, just return a mock session ID
        activeSessionId = 'mock-session-' + Date.now();
        console.log('Started mock usage tracking, session ID:', activeSessionId);
        return activeSessionId;
    }

    // End tracking when chat is closed
    async function endUsageTracking() {
        if (!activeSessionId) {
            return;
        }
        
        console.log('Ended mock usage tracking, session ID:', activeSessionId);
        activeSessionId = null;
    }
    
    // Function to check login state
    async function checkLoginState() {
        // For now, always set as logged in to bypass Google auth
        isLoggedIn = true;
        localStorage.setItem('isLoggedIn', 'true');
        
        // User is logged in, hide login container and show app
        loginContainer.classList.add('hidden');
        menuTab.style.display = 'block';
        
        // Generate random mock user data
        const randomNames = [
            "Alex Johnson", "Taylor Smith", "Jordan Lee", 
            "Casey Williams", "Morgan Brown", "Riley Davis",
            "Quinn Miller", "Avery Wilson", "Jamie Garcia",
            "Dakota Martinez"
        ];
        
        const randomEmails = [
            "gamer@example.com", "player1@gmail.com", "gamemaster@outlook.com",
            "esports@mail.com", "rpgfan@example.net", "strategist@gmail.com",
            "speedrunner@example.org", "casual_gamer@mail.com", "pro_player@example.com",
            "achievement_hunter@gmail.com"
        ];
        
        // Select random name and email
        const randomName = randomNames[Math.floor(Math.random() * randomNames.length)];
        const randomEmail = randomEmails[Math.floor(Math.random() * randomEmails.length)];
        
        // Generate random user ID
        const randomId = 'user_' + Math.random().toString(36).substring(2, 10);
        
        // Create mock user with random data
        const mockUser = {
            id: randomId,
            name: randomName,
            email: randomEmail,
            picture: ''
        };
        
        localStorage.setItem('user', JSON.stringify(mockUser));
        
        // Generate random subscription data
        const plans = ['basic', 'pro', 'ultimate'];
        const randomPlan = plans[Math.floor(Math.random() * plans.length)];
        const randomHoursUsed = Math.floor(Math.random() * 20);
        const randomHoursTotal = randomPlan === 'basic' ? 10 : 
                                randomPlan === 'pro' ? 30 : 100;
        
        // Set expiry date to a random date between 1 and 60 days from now
        const randomDays = Math.floor(Math.random() * 60) + 1;
        const expiryDate = new Date(Date.now() + randomDays * 24 * 60 * 60 * 1000);
        
        const mockSubscription = {
            userId: randomId,
            plan: randomPlan,
            status: 'active',
            currentPeriodEnd: expiryDate.toISOString(),
            hoursUsed: randomHoursUsed,
            hoursTotal: randomHoursTotal
        };
        
        localStorage.setItem('subscription', JSON.stringify(mockSubscription));
        
        // Log the random user data for debugging
        console.log('Generated random user:', mockUser);
        console.log('Generated random subscription:', mockSubscription);
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
            // Check if user is logged in
            if (!isLoggedIn) {
                alert('Please log in to use DUOAI');
                return;
            }
            
            // Check subscription status
            const hasActiveSubscription = await checkSubscriptionStatus();
            if (!hasActiveSubscription) {
                alert('Your subscription is not active or you have used all your allocated hours. Please upgrade your plan.');
                // Open pricing page in browser
                ipcRenderer.send('open-external-url', 'http://localhost:3000/pricing.html');
                return;
            }
            
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
            
            // Start usage tracking
            await startUsageTracking();
            
            // Get system prompt
            const systemPrompt = localStorage.getItem('currentSystemPrompt');
            console.log('System prompt retrieved:', systemPrompt ? 'Yes' : 'No');
            
            try {
                // Capture screenshot
                console.log('Capturing screenshot...');
                const screenshotPath = await screenshotUtil.captureScreenshot();
                console.log('Screenshot captured:', screenshotPath);
                
                // Create a message element for the AI response
                const messageElement = document.createElement('div');
                messageElement.classList.add('message', 'ai-message');
                
                // Create a text element that will be updated as we receive chunks
                const textElement = document.createElement('div');
                textElement.textContent = ''; // Start empty
                messageElement.appendChild(textElement);
                
                // Add the message element to the chat
                chatMessages.appendChild(messageElement);
                
                // Add typing indicator
                messageElement.classList.add('typing');
                
                // Call Claude API with streaming
                console.log('Sending message to Claude API with streaming...');
                let fullResponse = '';
                
                await claudeAPI.sendMessageWithScreenshotStreaming(
                    systemPrompt,
                    "I just started the app. What do you see in this screenshot? Can you provide any gaming advice based on what you see?",
                    screenshotPath,
                    // On chunk callback
                    (chunk) => {
                        // Update the text element with the new chunk
                        textElement.textContent += chunk;
                        
                        // Scroll to bottom as new text arrives
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    },
                    // On complete callback
                    (completeResponse) => {
                        // Remove typing indicator
                        messageElement.classList.remove('typing');
                        
                        // Store the full response
                        fullResponse = completeResponse;
                        
                        // Cache the response for offline use
                        cacheResponse('initial_message', fullResponse);
                        
                        // Speak the response
                        speechManager.speak(fullResponse).catch(error => {
                            console.error('Error speaking message:', error);
                        });
                    }
                );
                
                console.log('Streaming response from Claude API completed');
                
                // Clean up old screenshots
                screenshotUtil.cleanupOldScreenshots();
            } catch (error) {
                console.error('Error in API call or screenshot:', error);
                
                // Add error message to chat
                const messageElement = document.createElement('div');
                messageElement.classList.add('message', 'ai-message');
                
                const textElement = document.createElement('div');
                textElement.textContent = `I'm sorry, I encountered an error: ${error.message}. Please make sure the backend server is running.`;
                messageElement.appendChild(textElement);
                
                chatMessages.appendChild(messageElement);
            }
        } catch (error) {
            console.error('Unexpected error in start button handler:', error);
            alert(`An unexpected error occurred: ${error.message}`);
        }
    });
    
    // Close chat button functionality
    closeChatButton.addEventListener('click', async () => {
        // End usage tracking
        await endUsageTracking();
        
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
        
        // Sanitize input
        const sanitizedMessage = sanitizeInput(message);
        
        // Add user message to chat
        addMessage(sanitizedMessage, 'user');
        
        // Clear input
        userInput.value = '';
        userInput.style.height = 'auto';
        
        // Create a message element for the AI response
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'ai-message');
        
        // Create a text element that will be updated as we receive chunks
        const textElement = document.createElement('div');
        textElement.textContent = ''; // Start empty
        messageElement.appendChild(textElement);
        
        // Add the message element to the chat
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        try {
            // Check if we're online
            if (!isOnline()) {
                console.log('Device is offline, using cached responses if available');
                
                // Try to get a cached response
                const cachedResponse = getCachedResponse(`message_${sanitizedMessage.substring(0, 50)}`);
                
                if (cachedResponse) {
                    // Add cached AI message to chat
                    textElement.textContent = cachedResponse;
                    messageElement.classList.add('cached');
                    
                    // Add cached indicator
                    const cachedIndicator = document.createElement('div');
                    cachedIndicator.classList.add('cached-indicator');
                    cachedIndicator.textContent = 'Offline response';
                    messageElement.insertBefore(cachedIndicator, textElement);
                    
                    // Speak the response
                    speechManager.speak(cachedResponse).catch(error => {
                        console.error('Error speaking message:', error);
                    });
                    
                    return;
                } else {
                    textElement.textContent = 'You are currently offline and no cached response is available.';
                    return;
                }
            }
            
            // Capture screenshot
            const screenshotPath = await screenshotUtil.captureScreenshot();
            
            // Get system prompt
            const systemPrompt = localStorage.getItem('currentSystemPrompt');
            
            // Call Claude API with streaming
            let fullResponse = '';
            
            // Add typing indicator
            messageElement.classList.add('typing');
            
            await claudeAPI.sendMessageWithScreenshotStreaming(
                systemPrompt,
                sanitizedMessage,
                screenshotPath,
                // On chunk callback
                (chunk) => {
                    // Update the text element with the new chunk
                    textElement.textContent += chunk;
                    
                    // Scroll to bottom as new text arrives
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                },
                // On complete callback
                (completeResponse) => {
                    // Remove typing indicator
                    messageElement.classList.remove('typing');
                    
                    // Store the full response
                    fullResponse = completeResponse;
                    
                    // Cache the response for offline use
                    cacheResponse(`message_${sanitizedMessage.substring(0, 50)}`, fullResponse);
                    
                    // Speak the response
                    speechManager.speak(fullResponse).catch(error => {
                        console.error('Error speaking message:', error);
                    });
                }
            );
            
            // Clean up old screenshots
            screenshotUtil.cleanupOldScreenshots();
        } catch (error) {
            console.error('Error sending message:', error);
            
            // Update the message with the error
            textElement.textContent = getErrorMessage(error);
            messageElement.classList.remove('typing');
        }
    }
    
    // Helper function to get appropriate error message
    function getErrorMessage(error) {
        if (error.message.includes('offline')) {
            return "You're currently offline. Please check your internet connection and try again.";
        } else if (error.message.includes('server')) {
            return "I'm having trouble connecting to the server. Please try again in a moment.";
        } else {
            return "I'm sorry, I encountered an error. Please try again later.";
        }
    }
    
    // Function to sanitize user input
    function sanitizeInput(input) {
        // Basic sanitization - remove HTML tags
        return input.replace(/<[^>]*>?/gm, '');
    }
    
    // Function to add a message to the chat
    function addMessage(text, sender, isCached = false) {
        // If text is empty, don't add a message
        if (!text) return;
        
        // For streaming AI messages, we handle this differently in sendMessage
        if (sender === 'ai' && !isCached) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', `${sender}-message`);
            
            const textElement = document.createElement('div');
            textElement.textContent = text;
            messageElement.appendChild(textElement);
            
            chatMessages.appendChild(messageElement);
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Speak AI messages
            speechManager.speak(text).catch(error => {
                console.error('Error speaking message:', error);
            });
            
            return messageElement;
        }
        
        // For user messages and cached AI responses
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        
        // For cached responses, add an indicator
        if (isCached && sender === 'ai') {
            const cachedIndicator = document.createElement('div');
            cachedIndicator.classList.add('cached-indicator');
            cachedIndicator.textContent = 'Offline response';
            messageElement.appendChild(cachedIndicator);
        }
        
        const textElement = document.createElement('div');
        textElement.textContent = text;
        messageElement.appendChild(textElement);
        
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Speak AI messages
        if (sender === 'ai') {
            speechManager.speak(text).catch(error => {
                console.error('Error speaking message:', error);
            });
        }
        
        return messageElement;
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
        
        // Open the login URL in the default browser
        const loginUrl = authBridge.getLoginUrl();
        ipcRenderer.send('open-external-url', loginUrl);
    });
    
    // Logout function
    function logout() {
        // Open the logout URL in the default browser
        const logoutUrl = authBridge.getLogoutUrl();
        ipcRenderer.send('open-external-url', logoutUrl);
        
        // Clear local storage
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('user');
        localStorage.removeItem('subscription');
        
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
    
    // Settings button
    const settingsButton = document.createElement('button');
    settingsButton.id = 'settingsButton';
    settingsButton.className = 'secondary-button';
    settingsButton.textContent = 'Settings';
    settingsButton.style.marginTop = '15px';
    
    // Insert settings button before logout button
    logoutButton.parentNode.insertBefore(settingsButton, logoutButton);
    
    // Settings button functionality
    settingsButton.addEventListener('click', () => {
        ipcRenderer.send('open-settings');
    });
    
    // Volume slider event listener
    volumeSlider.addEventListener('input', () => {
        const volume = parseFloat(volumeSlider.value);
        speechManager.setVolume(volume);
        localStorage.setItem('speechVolume', volume);
    });
    
    // Voice selector event listener
    voiceSelector.addEventListener('change', () => {
        const voiceId = voiceSelector.value;
        speechManager.setVoice(voiceId);
        localStorage.setItem('selectedVoice', voiceId);
        
        // Test the selected voice with browser TTS
        speechManager.fallbackSpeak("Hello, I'm your gaming assistant.").catch(error => {
            console.error('Error testing voice:', error);
        });
    });

    // Microphone button event listener
    micButton.addEventListener('click', () => {
        if (speechManager.isListening) {
            stopSpeechRecognition();
        } else {
            startSpeechRecognition();
        }
    });

    // Function to start speech recognition
    function startSpeechRecognition() {
        if (!speechManager.isSpeechRecognitionSupported()) {
            alert('Speech recognition is not supported in this browser');
            return;
        }
        
        micButton.classList.add('recording');
        speechStatus.textContent = 'Listening...';
        
        speechManager.startListening(
            // On result
            (transcript) => {
                userInput.value = transcript;
                userInput.style.height = 'auto';
                userInput.style.height = (userInput.scrollHeight) + 'px';
                stopSpeechRecognition();
                
                // Auto-send after a short delay
                setTimeout(() => {
                    sendMessage();
                }, 500);
            },
            // On end
            (error) => {
                stopSpeechRecognition();
                if (error) {
                    speechStatus.textContent = 'Error: ' + error;
                    setTimeout(() => {
                        speechStatus.textContent = '';
                    }, 3000);
                }
            }
        );
    }

    // Function to stop speech recognition
    function stopSpeechRecognition() {
        speechManager.stopListening();
        micButton.classList.remove('recording');
        speechStatus.textContent = '';
    }

    // Load saved settings
    function loadSavedSettings() {
        const savedVolume = localStorage.getItem('speechVolume');
        if (savedVolume !== null) {
            const volume = parseFloat(savedVolume);
            volumeSlider.value = volume;
            speechManager.setVolume(volume);
        }
        
        // Load saved voice
        const savedVoice = localStorage.getItem('selectedVoice');
        if (savedVoice) {
            voiceSelector.value = savedVoice;
            speechManager.setVoice(savedVoice);
        }
    }
    
    // Test ElevenLabs TTS
    async function testElevenLabsTTS() {
        try {
            console.log('Testing ElevenLabs TTS...');
            // Skip actual testing since we're using browser TTS
            console.log('Using browser TTS instead of ElevenLabs');
            
            /* Disabled ElevenLabs testing temporarily
            const isAvailable = await speechManager.initElevenLabs();
            console.log('ElevenLabs available:', isAvailable);
            
            if (isAvailable) {
                console.log('ElevenLabs is available, testing voice...');
                // Don't actually play a test sound to avoid disrupting the user
                // Just log that it's ready
                console.log('ElevenLabs TTS is ready to use');
            } else {
                console.warn('ElevenLabs is not available, will use browser TTS');
            }
            */
        } catch (error) {
            console.error('Error testing ElevenLabs TTS:', error);
        }
    }

    // Check login state at startup
    checkLoginState();
    
    // Load saved settings
    loadSavedSettings();
    
    // Test ElevenLabs TTS
    testElevenLabsTTS();
    
    // Monitor network status
    const networkStatus = document.getElementById('networkStatus');
    
    function updateNetworkStatus() {
        if (navigator.onLine) {
            networkStatus.classList.remove('offline');
        } else {
            networkStatus.classList.add('offline');
        }
    }
    
    // Initial check
    updateNetworkStatus();
    
    // Add event listeners for network status changes
    window.addEventListener('online', () => {
        console.log('Device is now online');
        updateNetworkStatus();
        // Notify user
        addMessage("You're back online! Full functionality has been restored.", 'ai');
    });
    
    window.addEventListener('offline', () => {
        console.log('Device is now offline');
        updateNetworkStatus();
        // Notify user
        addMessage("You're offline. Limited functionality is available with cached responses.", 'ai');
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
