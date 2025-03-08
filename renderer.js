// First, import required modules at the very top of the file
const { ipcRenderer } = require('electron');
const screenshotUtil = require('./screenshot');
const claudeAPI = require('./claude_api');
const authBridge = require('./bridge');
const speechManager = require('./speech');

// Debug protocol handler registration
console.log('Renderer process started, protocol handlers should be registered');

// Add event listener for app closing
window.addEventListener('beforeunload', () => {
    // Clean up speech resources when the app is actually closing
    if (speechManager) {
        speechManager.cleanup();
    }
    
    // Tell main process audio playback is done
    ipcRenderer.send('keep-app-running', false);
});

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
    let isLoggedIn = false; // Track login state
    
    // Get auth form elements
    const loginToggle = document.getElementById('loginToggle');
    const registerToggle = document.getElementById('registerToggle');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginError = document.getElementById('loginError');
    const registerError = document.getElementById('registerError');
    const passwordStrength = document.getElementById('passwordStrength');
    const registerPassword = document.getElementById('registerPassword');
    
    // Ensure the register name field has the correct placeholder
    const registerNameInput = document.getElementById('registerName');
    if (registerNameInput) {
        registerNameInput.placeholder = 'Username';
    }

    // Form toggle
    loginToggle.addEventListener('click', () => {
        loginToggle.classList.add('active');
        registerToggle.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    });

    registerToggle.addEventListener('click', () => {
        registerToggle.classList.add('active');
        loginToggle.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    });

    // Password strength checker
    registerPassword.addEventListener('input', () => {
        const password = registerPassword.value;
        
        // Remove all classes
        passwordStrength.classList.remove('weak', 'medium', 'strong');
        
        if (password.length === 0) {
            return;
        }
        
        // Check password strength
        let strength = 0;
        
        // Length check
        if (password.length >= 8) strength += 1;
        
        // Complexity checks
        if (/[A-Z]/.test(password)) strength += 1;
        if (/[0-9]/.test(password)) strength += 1;
        if (/[^A-Za-z0-9]/.test(password)) strength += 1;
        
        // Set appropriate class
        if (strength <= 2) {
            passwordStrength.classList.add('weak');
        } else if (strength === 3) {
            passwordStrength.classList.add('medium');
        } else {
            passwordStrength.classList.add('strong');
        }
    });

    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        // Clear previous errors
        loginError.textContent = '';
        
        try {
            // Show loading state
            const submitButton = loginForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Logging in...';
            submitButton.disabled = true;
            
            // Call the login API through the bridge
            const response = await authBridge.loginWithCredentials(email, password);
            
            if (response.success) {
                // Store tokens in localStorage
                localStorage.setItem('authToken', response.token);
                localStorage.setItem('refreshToken', response.refreshToken);
                
                // Store user info
                localStorage.setItem('user', JSON.stringify(response.user));
                localStorage.setItem('isLoggedIn', 'true');
                
                // Update UI for logged in state
                isLoggedIn = true;
                loginContainer.classList.add('hidden');
                menuTab.style.display = 'block';
                
                // Check subscription status
                checkSubscriptionStatus();
            } else {
                loginError.textContent = response.message || 'Login failed. Please check your credentials.';
            }
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = error.message || 'An error occurred during login.';
        } finally {
            // Reset button state
            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.textContent = 'Login';
            submitButton.disabled = false;
        }
    });

    // Registration form submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('registerName').value; // Username field
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        
        // Clear previous errors
        registerError.textContent = '';
        
        // Validate passwords match
        if (password !== confirmPassword) {
            registerError.textContent = 'Passwords do not match.';
            return;
        }
        
        try {
            // Show loading state
            const submitButton = registerForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Registering...';
            submitButton.disabled = true;
            
            // Call the registration API through the bridge
            const response = await authBridge.registerWithCredentials(username, email, password);
            
            if (response.success) {
                // Instead of showing success message and switching to login form,
                // directly store the tokens and user info
                localStorage.setItem('authToken', response.token);
                localStorage.setItem('refreshToken', response.refreshToken);
                
                // Store user info
                localStorage.setItem('user', JSON.stringify(response.user));
                localStorage.setItem('isLoggedIn', 'true');
                
                // Update UI for logged in state
                isLoggedIn = true;
                loginContainer.classList.add('hidden');
                menuTab.style.display = 'block';
                
                // Check subscription status
                checkSubscriptionStatus();
                
                console.log('Auto-login successful after registration');
            } else {
                registerError.textContent = response.message || 'Registration failed. Please try again.';
            }
        } catch (error) {
            console.error('Registration error:', error);
            registerError.textContent = error.message || 'An error occurred during registration.';
        } finally {
            // Reset button state
            const submitButton = registerForm.querySelector('button[type="submit"]');
            submitButton.textContent = 'Register';
            submitButton.disabled = false;
        }
    });
    
    // Auth data handling removed
    
    
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
        try {
            // Check if we have a token
            const token = localStorage.getItem('authToken');
            
            if (!token) {
                // No token, user is not logged in
                isLoggedIn = false;
                localStorage.removeItem('isLoggedIn');
                loginContainer.classList.remove('hidden');
                menuTab.style.display = 'none';
                return false;
            }
            
            // Verify token with server
            const serverStatus = await authBridge.checkAuthStatus();
            
            if (serverStatus.isAuthenticated) {
                // User is logged in
                isLoggedIn = true;
                localStorage.setItem('isLoggedIn', 'true');
                
                // Hide login container and show app
                loginContainer.classList.add('hidden');
                menuTab.style.display = 'block';
                
                return true;
            } else if (serverStatus.tokenExpired) {
                // Token expired, try to refresh
                const refreshed = await authBridge.refreshToken();
                
                if (refreshed) {
                    // Token refreshed, check again
                    return checkLoginState();
                } else {
                    // Refresh failed, user needs to log in again
                    isLoggedIn = false;
                    localStorage.removeItem('isLoggedIn');
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('refreshToken');
                    loginContainer.classList.remove('hidden');
                    menuTab.style.display = 'none';
                    return false;
                }
            } else {
                // Token invalid, user needs to log in again
                isLoggedIn = false;
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('authToken');
                localStorage.removeItem('refreshToken');
                loginContainer.classList.remove('hidden');
                menuTab.style.display = 'none';
                return false;
            }
        } catch (error) {
            console.error('Error checking login state:', error);
            
            // Don't use mock login, just return false
            isLoggedIn = false;
            localStorage.removeItem('isLoggedIn');
            loginContainer.classList.remove('hidden');
            menuTab.style.display = 'none';
            return false;
        }
    }
    
    // Hide menu tab initially
    menuTab.style.display = 'none';
    
    // Function to select Nova by default
    const selectDefaultCharacter = () => {
        // Find the Nova character item
        const novaCharacterItem = Array.from(document.querySelectorAll('.character-item'))
            .find(item => item.querySelector('.character-name').textContent === 'Nova');
        
        if (novaCharacterItem) {
            console.log('Selecting Nova by default');
            
            // Add active class
            novaCharacterItem.classList.add('character-active');
            
            // Store the character name for later use
            localStorage.setItem('currentCharacter', 'Nova');
            
            // Set current character
            currentCharacter = 'Nova';
            
            // Set the voice for Nova
            const voiceId = getVoiceIdForCharacter('Nova');
            speechManager.setVoice(voiceId);
            localStorage.setItem('selectedVoice', voiceId);
        }
    };
    
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
                
                // Get the auth token to include in the request
                const authToken = localStorage.getItem('authToken');
            
                await claudeAPI.sendMessageWithScreenshotStreaming(
                    `*${getUsernameForMessage()} did not type a specific message at this time*`,
                    screenshotPath,
                    currentCharacter, // Pass character name
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
                    
                        // Note: We don't need to save the message here as it's already saved in claude-stream.js
                        
                        // Speak the response
                        speechManager.speak(fullResponse).catch(error => {
                            console.error('Error speaking message:', error);
                        });
                    },
                    // Pass the auth token
                    authToken
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
    
        // Don't call speechManager.cleanup() here as it would stop audio playback
        // Instead, just hide the chat container
    
        // Hide the chat container
        chatContainer.style.right = '-350px';
    
        // Show the menu tab
        menuTab.style.right = '0';
    
        // Resize window
        ipcRenderer.send('resize-window', { width: 50, height: 600 });
    
        // Note: We're intentionally not cleaning up speech resources
        // to allow audio to continue playing in the background
        console.log('Chat closed but audio playback will continue if in progress');
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
            
            // Get current character
            const currentCharacter = localStorage.getItem('currentCharacter');
            
            // Get the auth token
            const authToken = localStorage.getItem('authToken');
        
            // Call Claude API with streaming
            let fullResponse = '';
        
            // Add typing indicator
            messageElement.classList.add('typing');
        
            console.log('Sending message to Claude API with streaming...');
            console.log('Message:', sanitizedMessage);
            console.log('Character:', currentCharacter || 'None');
        
            await claudeAPI.sendMessageWithScreenshotStreaming(
                sanitizedMessage || `*${getUsernameForMessage()} did not type a specific message at this time*`,
                screenshotPath,
                currentCharacter, // Pass character name
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
                    
                    console.log('Received complete response from Claude API');
                    console.log('Response length:', fullResponse.length);
                    
                    // Cache the response for offline use
                    cacheResponse(`message_${sanitizedMessage.substring(0, 50)}`, fullResponse);
                    
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
    
    // Function to get username for messages
    function getUsernameForMessage() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            return user.name || 'User';
        } catch (e) {
            console.error('Error getting username:', e);
            return 'User';
        }
    }
    
    // Function to add a message to the chat
    function addMessage(text, sender, noSpeak = false) {
        // If text is empty, don't add a message
        if (!text) return;
    
        // For streaming AI messages, we handle this differently in sendMessage
        if (sender === 'ai' && !noSpeak) {
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
        if (sender === 'ai' && text.includes('[cached]')) {
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
    
        // Speak AI messages if not noSpeak
        if (sender === 'ai' && !noSpeak) {
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
    
    // Google login button removed
    
    // Diagnostic button removed
    
    // This function is no longer needed as we're using the postMessage approach
    
    // Google Sign-In functions removed
    
    // Logout function
    function logout() {
        // Clear tokens and user data
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('user');
        localStorage.removeItem('subscription');
        
        // Update UI
        isLoggedIn = false;
        loginContainer.classList.remove('hidden');
        menuTab.style.display = 'none';
        
        // Hide other containers
        sideMenu.style.right = '-300px';
        chatContainer.style.right = '-350px';
        
        // Resize window to show login
        ipcRenderer.send('resize-window', { width: 350, height: 500 });
        
        // Notify the server about logout (optional)
        try {
            const logoutUrl = authBridge.getLogoutUrl();
            fetch(logoutUrl, { method: 'POST' }).catch(err => console.error('Logout notification failed:', err));
        } catch (error) {
            console.error('Error during logout:', error);
        }
    }
    
    // Create a menu footer div to contain settings and logout buttons
    const menuFooter = document.createElement('div');
    menuFooter.className = 'menu-footer';
    
    // Add the menu footer to the side menu
    sideMenu.appendChild(menuFooter);
    
    // Settings button
    const settingsButton = document.createElement('button');
    settingsButton.id = 'settingsButton';
    settingsButton.className = 'secondary-button';
    settingsButton.textContent = 'Settings';
    
    // Add settings button to the menu footer
    menuFooter.appendChild(settingsButton);
    
    // Move logout button to the menu footer
    if (logoutButton.parentNode) {
        logoutButton.parentNode.removeChild(logoutButton);
    }
    menuFooter.appendChild(logoutButton);
    
    // Add event listener for logout button
    logoutButton.addEventListener('click', logout);
    
    // Create settings submenu
    const settingsSubmenu = document.createElement('div');
    settingsSubmenu.id = 'settingsSubmenu';
    settingsSubmenu.className = 'submenu';
    settingsSubmenu.innerHTML = `
        <div class="submenu-header">
            <button id="settingsBackButton" class="back-button">←</button>
            <h2>Settings</h2>
        </div>
        <div class="submenu-content">
            <div class="settings-section">
                <h3>Assistant Mode</h3>
                <div class="setting-item">
                    <label for="assistantModeToggle">Mode</label>
                    <div class="toggle-container">
                        <span class="toggle-label">Reactive</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="assistantModeToggle" checked>
                            <span class="toggle-slider"></span>
                        </label>
                        <span class="toggle-label">Proactive</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add the settings submenu to the document body
    document.body.appendChild(settingsSubmenu);
    
    // Settings button functionality
    settingsButton.addEventListener('click', () => {
        // Show the settings submenu
        settingsSubmenu.style.right = '0';
    });
    
    // Volume slider event listener
    volumeSlider.addEventListener('input', () => {
        const volume = parseFloat(volumeSlider.value);
        speechManager.setVolume(volume);
        localStorage.setItem('speechVolume', volume);
    });
    
    // Settings back button functionality
    document.getElementById('settingsBackButton').addEventListener('click', () => {
        // Hide the settings submenu
        settingsSubmenu.style.right = '-300px';
    });
    
    // Assistant mode toggle functionality
    const assistantModeToggle = document.getElementById('assistantModeToggle');
    assistantModeToggle.addEventListener('change', () => {
        const isProactive = assistantModeToggle.checked;
        localStorage.setItem('assistantMode', isProactive ? 'proactive' : 'reactive');
        console.log(`Assistant mode set to: ${isProactive ? 'Proactive' : 'Reactive'}`);
    });
    
    // Load saved assistant mode setting
    const savedAssistantMode = localStorage.getItem('assistantMode') || 'proactive';
    assistantModeToggle.checked = savedAssistantMode === 'proactive';

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
        
    }
    
    // Test ElevenLabs TTS
    async function testElevenLabsTTS() {
        try {
            console.log('Testing ElevenLabs TTS...');
            const isAvailable = await speechManager.initElevenLabs();
            console.log('ElevenLabs available:', isAvailable);
            
            if (isAvailable) {
                console.log('ElevenLabs is available, testing voice...');
                console.log('ElevenLabs TTS is ready to use');
            } else {
                console.warn('ElevenLabs is not available. Voice synthesis will not work.');
                // You could show a warning to the user here
                alert('ElevenLabs voice service is not available. Please check your API key configuration.');
            }
        } catch (error) {
            console.error('Error testing ElevenLabs TTS:', error);
        }
    }

    // Check login state at startup
    checkLoginState().then(isLoggedIn => {
        // Remove the development mode check
        console.log('Login state checked, isLoggedIn:', isLoggedIn);
    });
    
    // Load saved settings
    loadSavedSettings();
    
    // Test ElevenLabs TTS
    testElevenLabsTTS();
    
    // Function to check server connection
    async function checkServerConnection() {
        try {
            console.log('Checking server connection...');
            const serverRunning = await claudeAPI.checkServerStatus();
            const statusIndicator = document.getElementById('serverStatus');
            
            if (serverRunning) {
                console.log('Server is connected');
                statusIndicator.classList.remove('offline');
                statusIndicator.classList.add('online');
                statusIndicator.textContent = 'Server connected';
            } else {
                console.log('Server is disconnected');
                statusIndicator.classList.remove('online');
                statusIndicator.classList.add('offline');
                statusIndicator.textContent = 'Server disconnected';
            }
        } catch (error) {
            console.error('Error checking server status:', error);
            const statusIndicator = document.getElementById('serverStatus');
            statusIndicator.classList.remove('online');
            statusIndicator.classList.add('offline');
            statusIndicator.textContent = 'Server error: ' + error.message;
        }
    }
    
    // Monitor network status
    const networkStatus = document.getElementById('networkStatus');
    
    function updateNetworkStatus() {
        if (navigator.onLine) {
            networkStatus.classList.remove('offline');
        } else {
            networkStatus.classList.add('offline');
        }
    }
    
    // Initial checks
    updateNetworkStatus();
    checkServerConnection();
    
    // Check server status periodically
    setInterval(checkServerConnection, 60000); // Check every minute
    
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
    
    // Function to get the voice ID for a character
    function getVoiceIdForCharacter(characterName) {
        const characterVoices = {
            'Nova': 'EXAVITQu4vr4xnSDxMaL', // Sarah - analytical and supportive
            'Orion': 'TX3LPaxmHKxFdv7VOQHJ', // Liam - motivational coach
            'Lyra': 'XB0fDUnXU5powFXDhCwa', // Charlotte - patient teacher
            'Zephyr': 'pFZP5JQG7iQjIQuC4Bku', // Lily - playful companion
            'Thorne': 'JBFqnCBsd6RMkjVDRZzb'  // George - protective mentor
        };
        
        return characterVoices[characterName] || 'JBFqnCBsd6RMkjVDRZzb'; // Default to George
    }

    // Function to load character-specific messages
    async function loadCharacterMessages(characterName) {
        try {
            // Get the auth token
            const authToken = localStorage.getItem('authToken');
            if (!authToken) {
                console.error('No auth token available');
                return [];
            }
            
            // Fetch messages for the specific character
            const response = await fetch(`${authBridge.baseUrl}/api/messages?character=${encodeURIComponent(characterName)}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch messages: ${response.status}`);
            }
            
            const data = await response.json();
            return data.messages || [];
        } catch (error) {
            console.error('Error loading character messages:', error);
            return [];
        }
    }

    // Add click event listeners to character items
    document.querySelectorAll('.character-item').forEach(item => {
        item.addEventListener('click', async () => {
            // Remove active class from all items
            document.querySelectorAll('.character-item').forEach(i => {
                i.classList.remove('character-active');
            });
            
            // Add active class to clicked item
            item.classList.add('character-active');
            
            // Get character name
            const characterName = item.querySelector('.character-name').textContent;
            console.log(`Selected character: ${characterName}`);
            
            // Store the character name for later use
            localStorage.setItem('currentCharacter', characterName);
            
            // Set current character
            currentCharacter = characterName;
            
            // Set the voice for the selected character
            const voiceId = getVoiceIdForCharacter(characterName);
            speechManager.setVoice(voiceId);
            localStorage.setItem('selectedVoice', voiceId);
            
            // If the chat is open, load character-specific messages
            if (chatContainer.style.right === '0px') {
                // Clear previous messages
                chatMessages.innerHTML = '';
                
                // Update the character info in the chat header
                selectedCharacter.innerHTML = `
                    <div class="character-avatar">${characterName.charAt(0)}</div>
                    <div class="character-info">${characterName}</div>
                `;
                
                // Add a loading indicator
                addLoadingIndicator();
                
                // Load character-specific messages
                const messages = await loadCharacterMessages(characterName);
                
                // Remove loading indicator
                removeLoadingIndicator();
                
                // Display messages if any
                if (messages.length > 0) {
                    // Sort messages by timestamp (oldest first)
                    messages.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
                    
                    // Add messages to chat
                    messages.forEach(message => {
                        const sender = message.Role === 'user' ? 'user' : 'ai';
                        addMessage(message.Content, sender, true); // true means don't speak
                    });
                    
                    // Scroll to bottom
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                } else {
                    // Add welcome message
                    const welcomeMessage = document.createElement('div');
                    welcomeMessage.className = 'welcome-message';
                    welcomeMessage.textContent = `Start a conversation with ${characterName} by sending a message or taking a screenshot.`;
                    chatMessages.appendChild(welcomeMessage);
                }
            }
            
            // Optional: Close the submenu after selection
            // charactersSubmenu.style.right = '-300px';
        });
    });
});
