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
    
    // Variable to track continuous listening state
    let continuousListeningActive = true; // Start with continuous listening enabled
    let proactiveMessageTimer = null;
    
    // Function to ensure menu tab is visible and properly positioned
    function ensureMenuTabVisibility() {
        if (menuTab) {
            // Force the menu tab to be visible and positioned correctly with !important flags
            menuTab.style.setProperty('display', 'block', 'important');
            menuTab.style.setProperty('visibility', 'visible', 'important');
            menuTab.style.setProperty('opacity', '1', 'important');
            menuTab.style.setProperty('position', 'fixed', 'important');
            menuTab.style.setProperty('right', menuOpen ? '300px' : '0', 'important');
            menuTab.style.setProperty('top', '50%', 'important');
            menuTab.style.setProperty('transform', 'translateY(-50%)', 'important');
            menuTab.style.setProperty('z-index', '9999', 'important');
            menuTab.style.setProperty('pointer-events', 'auto', 'important');
            
            // Add a debug log to confirm the tab's visibility state
            console.log('Menu tab visibility enforced, position:', menuTab.style.right, 
                        'display:', window.getComputedStyle(menuTab).display,
                        'visibility:', window.getComputedStyle(menuTab).visibility);
        } else {
            console.error('Menu tab element not found when trying to enforce visibility');
        }
    }
    
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
    
    // Update placeholder to reflect email or username
    const loginEmailInput = document.getElementById('loginEmail');
    if (loginEmailInput) {
        loginEmailInput.placeholder = 'Email or Username';
        loginEmailInput.type = 'text'; // Change to text type to allow usernames
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
        
        const emailOrUsername = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        // Update placeholder to reflect email or username
        const loginEmailInput = document.getElementById('loginEmail');
        if (loginEmailInput) {
            loginEmailInput.placeholder = 'Email or Username';
            loginEmailInput.type = 'text'; // Ensure it's text type
        }
        
        // Clear previous errors
        loginError.textContent = '';
        
        try {
            // Show loading state
            const submitButton = loginForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Logging in...';
            submitButton.disabled = true;
            
            console.log('Attempting login with:', emailOrUsername); // Add logging
            
            // Call the login API through the bridge
            // Pass the input value as is - the backend will determine if it's an email or username
            const response = await authBridge.loginWithCredentials(emailOrUsername, password);
            
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
            
                // Start continuous listening now that user is logged in
                initializeContinuousListening();
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
                
                // Start continuous listening now that user is logged in
                initializeContinuousListening();
                
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
    
    // Apply direct styles to ensure clickability and visibility
    menuTab.style.pointerEvents = 'auto';
    menuTab.style.cursor = 'pointer';
    menuTab.style.zIndex = '9999';
    menuTab.style.display = 'block';
    menuTab.style.visibility = 'visible';
    menuTab.style.opacity = '1';
    menuTab.style.right = '0'; // Ensure it's positioned at the right edge
    
    // Debug menu tab styles
    console.log('Menu tab display:', window.getComputedStyle(menuTab).display);
    console.log('Menu tab visibility:', window.getComputedStyle(menuTab).visibility);
    console.log('Menu tab opacity:', window.getComputedStyle(menuTab).opacity);
    console.log('Menu tab right position:', window.getComputedStyle(menuTab).right);
    console.log('Menu tab z-index:', window.getComputedStyle(menuTab).zIndex);
    
    let menuOpen = false;
    let currentCharacter = null;
    
    // Create journal button
    const journalButton = document.createElement('button');
    journalButton.className = 'journal-button';
    journalButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>';
    journalButton.title = 'Companion Journal';
    journalButton.onclick = openQuestJournal;
    
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
                
                // Hide login container
                loginContainer.classList.add('hidden');
                
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
    
    // Always show menu tab
    menuTab.style.display = 'block';
    
    // Check if the menu tab is positioned off-screen
    const rect = menuTab.getBoundingClientRect();
    console.log('Menu tab position:', rect);
    console.log('Window dimensions:', {
        width: window.innerWidth,
        height: window.innerHeight
    });

    // If it's off-screen, force it back on-screen
    if (rect.right < 0 || rect.left > window.innerWidth) {
        console.log('Menu tab is off-screen, forcing it back');
        menuTab.style.right = '0';
    }
    
    // Function to debug element styles
    function debugElementStyles(element) {
        const styles = [];
        const sheets = document.styleSheets;
        
        for (let i = 0; i < sheets.length; i++) {
            let rules;
            try {
                rules = sheets[i].cssRules || sheets[i].rules;
            } catch (e) {
                console.warn('Cannot access stylesheet rules', e);
                continue;
            }
            
            for (let j = 0; j < rules.length; j++) {
                try {
                    if (element.matches(rules[j].selectorText)) {
                        styles.push({
                            selector: rules[j].selectorText,
                            properties: rules[j].cssText
                        });
                    }
                } catch (e) {
                    // Skip rules that can't be processed
                }
            }
        }
        
        console.log('CSS rules affecting menu tab:', styles);
    }

    // Call the function for the menu tab
    debugElementStyles(menuTab);
    
    // Function to select Zephyr by default
    const selectDefaultCharacter = () => {
        // Find the Zephyr character item
        const zephyrCharacterItem = Array.from(document.querySelectorAll('.character-item'))
            .find(item => item.querySelector('.character-name').textContent === 'Zephyr');
        
        if (zephyrCharacterItem) {
            console.log('Selecting Zephyr by default');
            
            // Add active class
            zephyrCharacterItem.classList.add('character-active');
            
            // Store the character name for later use
            localStorage.setItem('currentCharacter', 'Zephyr');
            
            // Set current character
            currentCharacter = 'Zephyr';
            
            // Set the voice for Zephyr
            const voiceId = getVoiceIdForCharacter('Zephyr');
            speechManager.setVoice(voiceId);
            localStorage.setItem('selectedVoice', voiceId);
        }
    };
    
    // Function to update the character button text
    function updateCharacterButtonText() {
        const charactersButton = document.getElementById('charactersButton');
        const currentChar = localStorage.getItem('currentCharacter') || 'Zephyr';
        
        if (charactersButton) {
            charactersButton.textContent = currentChar;
        }
    }
    
    // Call the function to select Zephyr by default
    selectDefaultCharacter();
    
    // Update character button text
    updateCharacterButtonText();
    
    // Ensure menu tab is in the correct position at startup
    menuTab.style.right = '0';
    
    // Force menu tab to be visible with important flags
    menuTab.style.setProperty('display', 'block', 'important');
    menuTab.style.setProperty('visibility', 'visible', 'important');
    menuTab.style.setProperty('opacity', '1', 'important');
    
    // Add loading indicator to menu tab
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'tab-loading-indicator';
    menuTab.appendChild(loadingIndicator);
    
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
        
        // Force visibility and position after state change - call immediately and after a delay
        ensureMenuTabVisibility();
        setTimeout(ensureMenuTabVisibility, 50);
        setTimeout(ensureMenuTabVisibility, 200);
    }
    
    // Add the click event listener
    menuTab.addEventListener('click', handleMenuTabClick);
    
    // Also add a mousedown event for better responsiveness
    menuTab.addEventListener('mousedown', function(event) {
        console.log('Mouse down on menu tab');
    });
    
    // Call this function initially
    ensureMenuTabVisibility();

    // Also call it after a short delay to override any other scripts that might change it
    setTimeout(ensureMenuTabVisibility, 500);

    // Call it periodically to ensure it stays visible - increase frequency
    setInterval(ensureMenuTabVisibility, 2000); // Check every 2 seconds instead of 5

    // Also call it on window resize with additional delayed check
    window.addEventListener('resize', () => {
        ensureMenuTabVisibility();
        // Call again after a short delay to handle any CSS transitions
        setTimeout(ensureMenuTabVisibility, 300);
    });
    
    // Function to update relationship depth indicator
    async function updateRelationshipDepth(characterName) {
        try {
            const authToken = localStorage.getItem('authToken');
            if (!authToken) return;
            
            // Try to get cached relationship data first
            const cachedData = getCachedResponse(`relationship_${characterName}`);
            let data;
            
            try {
                const response = await fetch(`${authBridge.baseUrl}/api/quests/relationship?character=${encodeURIComponent(characterName)}`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                
                if (!response.ok) {
                    console.warn(`Failed to fetch relationship depth: ${response.status}`);
                    // If we have cached data, use it instead of throwing an error
                    if (cachedData) {
                        data = cachedData;
                        console.log('Using cached relationship data');
                    } else {
                        // Use default values if no cached data
                        data = { 
                            level: "New Acquaintance", 
                            tier: 1, 
                            progress: 0, 
                            score: 0,
                            completedCount: 0
                        };
                    }
                } else {
                    data = await response.json();
                    // Cache the successful response
                    cacheResponse(`relationship_${characterName}`, data);
                }
            } catch (fetchError) {
                console.warn('Network error fetching relationship data:', fetchError);
                // If we have cached data, use it
                if (cachedData) {
                    data = cachedData;
                    console.log('Using cached relationship data due to network error');
                } else {
                    // Use default values if no cached data
                    data = { 
                        level: "New Acquaintance", 
                        tier: 1, 
                        progress: 0, 
                        score: 0,
                        completedCount: 0
                    };
                }
            }
            
            // Update UI elements
            const levelElement = document.querySelector('.relationship-level');
            const progressElement = document.querySelector('.relationship-progress');
            
            if (levelElement) {
                levelElement.textContent = data.level;
                levelElement.className = `relationship-level tier-${data.tier}`;
            }
            
            if (progressElement) {
                progressElement.style.width = `${data.progress * 100}%`;
            }
            
            // Add score tooltip
            const indicator = document.querySelector('.relationship-indicator');
            if (indicator) {
                indicator.title = `Relationship Score: ${data.score} points\nCompleted Quests: ${data.completedCount || 0}`;
            }
            
            console.log('Updated relationship depth:', data);
        } catch (error) {
            console.error('Error updating relationship depth:', error);
            // Don't let this error affect the rest of the application
        }
    }

    // Start button functionality
    startButton.addEventListener('click', async () => {
        console.log('Start button clicked');
        
        try {
            // Check if user is logged in
            if (!isLoggedIn) {
                alert('Please log in to use DUOAI');
                return;
            }
            
            // Show loading indicator on menu tab
            showMenuTabLoading();
            
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
                <div class="relationship-indicator">
                    <div class="relationship-level">New Acquaintance</div>
                    <div class="relationship-progress-bar">
                        <div class="relationship-progress"></div>
                    </div>
                </div>
            `;
            
            // Fetch relationship depth
            updateRelationshipDepth(currentCharacter);
            
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
        
                // Get the current message count
                const currentMessageCount = chatMessages.querySelectorAll('.message').length || 0;
            
                await claudeAPI.sendMessageWithScreenshotStreaming(
                    '', // Empty message will trigger the default prompt in claude_api.js
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
                    
                        // Hide loading indicator on menu tab
                        hideMenuTabLoading();
                    
                        // Speak the response
                        speechManager.speak(fullResponse).catch(error => {
                            console.error('Error speaking message:', error);
                        });
                    },
                    // Pass the auth token
                    authToken,
                    // Pass the message count
                    currentMessageCount
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
    
        // Clear proactive message timer when chat is closed
        if (proactiveMessageTimer) {
            clearTimeout(proactiveMessageTimer);
            proactiveMessageTimer = null;
        }
    
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
        
        // Ensure menu tab is visible after chat is closed
        setTimeout(ensureMenuTabVisibility, 100);
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
        
        // Show loading indicator on menu tab
        showMenuTabLoading();
        
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
        
            // Get the current message count
            const currentMessageCount = chatMessages.querySelectorAll('.message').length || 0;
            
            await claudeAPI.sendMessageWithScreenshotStreaming(
                sanitizedMessage, // The formatting will be handled in claude_api.js
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
                    
                    // Hide loading indicator on menu tab
                    hideMenuTabLoading();
                    
                    // Speak the response
                    speechManager.speak(fullResponse).catch(error => {
                        console.error('Error speaking message:', error);
                    });
                },
                // Pass the auth token (undefined is fine)
                undefined,
                // Pass the message count
                currentMessageCount
            );
            
            console.log('Streaming response from Claude API completed');
            
            // Clean up old screenshots
            screenshotUtil.cleanupOldScreenshots();
            
            // Reset proactive message timer after user sends a message
            setupProactiveMessaging();
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
    
    // Function to handle proactive messaging
    function setupProactiveMessaging() {
        // Clear any existing timer
        if (proactiveMessageTimer) {
            clearTimeout(proactiveMessageTimer);
            proactiveMessageTimer = null;
        }
        
        // Check if proactive mode is enabled
        const isProactiveMode = localStorage.getItem('assistantMode') === 'proactive';
        if (!isProactiveMode) {
            console.log('Proactive mode is disabled, not setting up timer');
            return;
        }
        
        console.log('Setting up proactive message timer (30 seconds)');
        
        // Set a timer to send a proactive message after 30 seconds
        proactiveMessageTimer = setTimeout(async () => {
            // Only send a proactive message if:
            // 1. We're not already waiting for an answer (no typing indicator visible)
            // 2. Audio is not currently playing
            // 3. Chat is open
            const isWaitingForAnswer = document.querySelector('.typing') !== null;
            const isChatOpen = chatContainer.style.right === '0px';
            
            if (!isWaitingForAnswer && !speechManager.isPlayingAudio && isChatOpen) {
                console.log('Sending proactive message');
                
                try {
                    // Capture screenshot
                    const screenshotPath = await screenshotUtil.captureScreenshot();
                    
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
                    
                    // Scroll to bottom
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    
                    // Get current character
                    const currentCharacter = localStorage.getItem('currentCharacter');
                    
                    // Get the auth token
                    const authToken = localStorage.getItem('authToken');
                    
                    // Call Claude API with streaming
                    let fullResponse = '';
                    
                    // Get the current message count
                    const currentMessageCount = chatMessages.querySelectorAll('.message').length || 0;
                    
                    await claudeAPI.sendMessageWithScreenshotStreaming(
                        '*proactive message*', // Special flag to indicate this is a proactive message
                        screenshotPath,
                        currentCharacter,
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
                            
                            // Speak the response
                            speechManager.speak(fullResponse).catch(error => {
                                console.error('Error speaking message:', error);
                            });
                        },
                        authToken,
                        currentMessageCount
                    );
                    
                    // Clean up old screenshots
                    screenshotUtil.cleanupOldScreenshots();
                } catch (error) {
                    console.error('Error sending proactive message:', error);
                }
            } else {
                console.log('Skipping proactive message: ' + 
                            (isWaitingForAnswer ? 'waiting for answer' : '') +
                            (speechManager.isPlayingAudio ? ', audio playing' : '') +
                            (!isChatOpen ? ', chat closed' : ''));
            }
        }, 30000); // 30 seconds
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
    
    // Function to show the loading indicator on the menu tab
    function showMenuTabLoading() {
        const loadingIndicator = document.querySelector('.tab-loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('active');
        }
    }

    // Function to hide the loading indicator on the menu tab
    function hideMenuTabLoading() {
        const loadingIndicator = document.querySelector('.tab-loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('active');
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
        // Stop continuous listening
        if (continuousListeningActive) {
            speechManager.stopListening();
            micButton.classList.remove('recording');
            speechStatus.textContent = '';
            continuousListeningActive = false;
        }
    
        // Clear tokens and user data
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('user');
        localStorage.removeItem('subscription');
    
        // Update UI
        isLoggedIn = false;
        loginContainer.classList.remove('hidden');

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
        
        // Clear and potentially set up proactive messaging based on new setting
        if (isProactive) {
            setupProactiveMessaging();
        } else {
            // Clear any existing timer if switching to reactive mode
            if (proactiveMessageTimer) {
                clearTimeout(proactiveMessageTimer);
                proactiveMessageTimer = null;
            }
        }
    });
    
    // Load saved assistant mode setting
    const savedAssistantMode = localStorage.getItem('assistantMode') || 'proactive';
    assistantModeToggle.checked = savedAssistantMode === 'proactive';

    // Initialize continuous listening when the app starts
    function initializeContinuousListening() {
        // First check if user is logged in
        if (!isLoggedIn) {
            console.log('User not logged in, not starting continuous listening');
            micButton.classList.remove('recording');
            speechStatus.textContent = 'Login required';
            continuousListeningActive = false;
            return;
        }
        
        // Don't initialize if speech is playing
        if (speechManager.isPlayingAudio) {
            console.log('Audio is playing, not initializing continuous listening');
            return;
        }
        
        if (speechManager.isSpeechRecognitionSupported()) {
            speechManager.startContinuousListening(
                // On result
                (transcript) => {
                    userInput.value = transcript;
                    userInput.style.height = 'auto';
                    userInput.style.height = (userInput.scrollHeight) + 'px';
                    
                    // Auto-send after transcript is received
                    sendMessage();
                },
                // On end
                (error) => {
                    if (error) {
                        // Don't show error if it's due to audio playing
                        if (error === 'Audio is playing') {
                            speechStatus.textContent = 'Paused during playback';
                            return;
                        }
                        
                        speechStatus.textContent = 'Error: ' + error;
                        setTimeout(() => {
                            speechStatus.textContent = '';
                        }, 3000);
                        
                        // Try to restart continuous listening
                        setTimeout(() => {
                            if (continuousListeningActive && !speechManager.isPlayingAudio) {
                                initializeContinuousListening();
                            }
                        }, 5000);
                    }
                }
            );
            
            // Update UI to show continuous listening is active
            micButton.classList.add('recording');
            speechStatus.textContent = 'Listening...';
            continuousListeningActive = true;
        } else {
            console.warn('Speech recognition not supported');
            speechStatus.textContent = 'Speech recognition not available';
        }
    }
    
    // Don't start continuous listening immediately, wait for login check
    checkLoginState().then(loggedIn => {
        console.log('Login state checked, isLoggedIn:', loggedIn);
        
        // Only initialize continuous listening if logged in
        if (loggedIn) {
            initializeContinuousListening();
        } else {
            // Update UI to show login required
            micButton.classList.remove('recording');
            speechStatus.textContent = 'Login required';
            continuousListeningActive = false;
        }
    });
    
    // Microphone button event listener
    micButton.addEventListener('click', () => {
        if (continuousListeningActive) {
            // Turn off continuous listening
            speechManager.stopListening();
            micButton.classList.remove('recording');
            speechStatus.textContent = '';
            continuousListeningActive = false;
        } else {
            // Turn on continuous listening
            initializeContinuousListening();
        }
    });

    // Load saved settings
    function loadSavedSettings() {
        const savedVolume = localStorage.getItem('speechVolume');
        if (savedVolume !== null) {
            const volume = parseFloat(savedVolume);
            volumeSlider.value = volume;
            speechManager.setVolume(volume);
        }
        
        // Load continuous listening preference
        const savedContinuousListening = localStorage.getItem('continuousListening');
        if (savedContinuousListening !== null) {
            continuousListeningActive = savedContinuousListening === 'true';
            
            // Update UI to match saved preference
            if (continuousListeningActive) {
                micButton.classList.add('recording');
                speechStatus.textContent = 'Listening...';
                // Don't start listening here, it will be started in initializeContinuousListening
            } else {
                micButton.classList.remove('recording');
                speechStatus.textContent = '';
            }
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
        
        // Login state is already checked in the earlier code that initializes continuous listening
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
    
    // Update relationship depth periodically
    setInterval(() => {
        const currentCharacter = localStorage.getItem('currentCharacter');
        if (currentCharacter && chatContainer.style.right === '0px') {
            updateRelationshipDepth(currentCharacter);
        }
    }, 60000); // Update every 60 seconds
    
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

    // Function to open quest journal
    function openQuestJournal() {
        // Get current character
        const currentCharacter = localStorage.getItem('currentCharacter');
        if (!currentCharacter) {
            alert('Please select a character first');
            return;
        }
        
        // Create journal overlay
        const journalOverlay = document.createElement('div');
        journalOverlay.className = 'journal-overlay';
        
        // Get quest data from API
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            alert('You need to be logged in to view the journal');
            return;
        }
        
        // Show loading state
        journalOverlay.innerHTML = `
            <div class="journal-container">
                <div class="journal-header">
                    <h2>${currentCharacter}'s Companion Journal</h2>
                    <button class="journal-close">×</button>
                </div>
                <div class="journal-content">
                    <div class="loading-indicator">
                        <div class="loading-dot"></div>
                        <div class="loading-dot"></div>
                        <div class="loading-dot"></div>
                    </div>
                </div>
            </div>
        `;
        
        // Add close button functionality
        journalOverlay.querySelector('.journal-close').onclick = () => {
            journalOverlay.classList.add('closing');
            setTimeout(() => journalOverlay.remove(), 500);
        };
        
        // Add to DOM and animate in
        document.body.appendChild(journalOverlay);
        setTimeout(() => journalOverlay.classList.add('open'), 10);
        
        // Fetch quest data
        fetch(`${authBridge.baseUrl}/api/quests/journal?character=${encodeURIComponent(currentCharacter)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        })
        .then(res => res.json())
        .then(data => {
            const { active, completed, relationship } = data;
            
            // Update journal content
            const journalContent = journalOverlay.querySelector('.journal-content');
            
            journalContent.innerHTML = `
                <div class="journal-header">
                    <div class="relationship-status">
                        <span class="status-label">Relationship:</span>
                        <span class="status-value tier-${relationship.tier}">${relationship.level}</span>
                        <span class="relationship-score">(${relationship.score} pts)</span>
                    </div>
                </div>
                
                <div class="journal-section">
                    <h3>Discoveries About You</h3>
                    <div class="completed-quests">
                        ${renderCompletedQuests(completed)}
                    </div>
                </div>
                
                <div class="journal-section">
                    <h3>${currentCharacter}'s Curiosities</h3>
                    <div class="active-quests">
                        ${renderActiveQuests(active)}
                    </div>
                </div>
            `;
        })
        .catch(error => {
            console.error('Error fetching quest journal:', error);
            
            // Show error message
            const journalContent = journalOverlay.querySelector('.journal-content');
            journalContent.innerHTML = `
                <div class="error-message">
                    <p>Failed to load journal data. Please try again later.</p>
                    <p>Error: ${error.message}</p>
                </div>
            `;
        });
    }
    
    // Function to render completed quests
    function renderCompletedQuests(completed) {
        if (!completed || completed.length === 0) {
            return '<p class="empty-state">No discoveries yet. Keep chatting!</p>';
        }
        
        return completed.map(quest => `
            <div class="journal-entry completed">
                <div class="entry-header">
                    <span class="entry-date">${formatDate(quest.completedAt)}</span>
                    <span class="entry-badge tier-${quest.tier}">Milestone</span>
                </div>
                <div class="entry-title">${quest.name}</div>
                <div class="entry-content">${generateQuestMemory(quest)}</div>
            </div>
        `).join('');
    }
    
    // Function to render active quests
    function renderActiveQuests(active) {
        if (!active || active.length === 0) {
            return '<p class="empty-state">No active curiosities at the moment.</p>';
        }
        
        return active.map(quest => `
            <div class="journal-entry">
                <div class="entry-header">
                    <span class="entry-badge tier-${quest.tier}">Ongoing</span>
                </div>
                <div class="entry-title">${quest.name}</div>
                <div class="entry-content">I'm curious to learn more about this...</div>
            </div>
        `).join('');
    }
    
    // Function to generate a personalized memory based on the quest
    function generateQuestMemory(quest) {
        // If we have evidence, use it
        if (quest.evidence && quest.evidence.evidence) {
            return quest.evidence.evidence;
        }
        
        // Otherwise, generate based on quest name
        switch(quest.questId) {
            case 'ice-breaker':
                return 'We shared a moment of laughter together.';
            case 'gaming-origin':
                return 'You shared how your gaming journey began.';
            case 'current-obsession':
                return 'You told me about a game you\'re currently passionate about.';
            case 'gaming-memory':
                return 'You shared a meaningful gaming memory with me.';
            case 'hidden-gem':
                return 'You introduced me to an underrated game you appreciate.';
            case 'gaming-frustration':
                return 'You opened up about something that frustrates you in games.';
            case 'breakthrough-moment':
                return 'You shared a moment of triumph when you overcame a gaming challenge.';
            default:
                return `We connected over ${quest.name.toLowerCase()}.`;
        }
    }
    
    // Function to format date
    function formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    }
    
    // Function to show quest completion notification
    function showQuestCompletion(questName, tier) {
        const notification = document.createElement('div');
        notification.className = 'quest-notification';
        notification.innerHTML = `
            <div class="quest-icon">✨</div>
            <div class="quest-info">
                <div class="quest-title">Connection Deepened</div>
                <div class="quest-description">${questName}</div>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Animate out after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 500);
        }, 5000);
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
            
            // Update the character button text to show selected character
            updateCharacterButtonText();
            
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
            
                // Add journal button to chat header if not already there
                const chatHeader = document.querySelector('.chat-header');
                if (!chatHeader.querySelector('.journal-button')) {
                    chatHeader.insertBefore(journalButton, closeChatButton);
                }
                
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
