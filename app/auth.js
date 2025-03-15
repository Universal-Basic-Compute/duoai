document.addEventListener('DOMContentLoaded', () => {
    // Tab switching functionality
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding form
            forms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${tabName}-form`) {
                    form.classList.add('active');
                }
            });
            
            // Clear messages
            document.querySelectorAll('.auth-message').forEach(msg => {
                msg.textContent = '';
                msg.className = 'auth-message';
            });
        });
    });
    
    // Password visibility toggle
    const toggleButtons = document.querySelectorAll('.toggle-password');
    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const input = button.parentElement.querySelector('input');
            const icon = button.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
    
    // Function to check if running in Electron environment
    function isElectron() {
        // Renderer process
        if (typeof window !== 'undefined' && typeof window.process === 'object' && window.process.type === 'renderer') {
            return true;
        }
        // Main process
        if (typeof process !== 'undefined' && typeof process.versions === 'object' && !!process.versions.electron) {
            return true;
        }
        // Detect the user agent when the `nodeIntegration` option is set to false
        if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
            return true;
        }
        return false;
    }
    
    // Function to get API base URL
    function getApiBaseUrl() {
        return isElectron() ? 'https://duogaming.ai/api' : '/api';
    }
    
    // Login form submission
    const loginForm = document.getElementById('login-form');
    const loginMessage = document.getElementById('login-message');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Clear previous messages
        loginMessage.textContent = '';
        loginMessage.className = 'auth-message';
        
        // Get form data
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        
        // Basic validation
        if (!username || !password) {
            loginMessage.textContent = 'Please enter both username and password';
            loginMessage.className = 'auth-message error';
            return;
        }
        
        try {
            // Show loading state
            const submitButton = loginForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Logging in...';
            submitButton.disabled = true;
            
            // Make API request
            const response = await fetch(`${getApiBaseUrl()}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });
            
            const data = await response.json();
            
            // Reset button state
            submitButton.textContent = originalText;
            submitButton.disabled = false;
            
            if (response.ok) {
                // Login successful
                loginMessage.textContent = 'Login successful! Redirecting...';
                loginMessage.className = 'auth-message success';
                
                // Store auth data in localStorage
                localStorage.setItem('duoai_auth_token', data.token);
                localStorage.setItem('duoai_username', data.username);
                
                // Redirect to main app after a short delay
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                // Login failed
                loginMessage.textContent = data.error || 'Login failed. Please try again.';
                loginMessage.className = 'auth-message error';
            }
        } catch (error) {
            console.error('Login error:', error);
            loginMessage.textContent = 'An error occurred. Please try again later.';
            loginMessage.className = 'auth-message error';
            
            // Reset button state
            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.textContent = 'Login';
            submitButton.disabled = false;
        }
    });
    
    // Register form submission
    const registerForm = document.getElementById('register-form');
    const registerMessage = document.getElementById('register-message');
    
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Clear previous messages
        registerMessage.textContent = '';
        registerMessage.className = 'auth-message';
        
        // Get form data
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        
        // Basic validation
        if (!username || !email || !password || !confirmPassword) {
            registerMessage.textContent = 'Please fill in all fields';
            registerMessage.className = 'auth-message error';
            return;
        }
        
        // Validate username format
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            registerMessage.textContent = 'Username must be 3-20 characters and contain only letters, numbers, and underscores';
            registerMessage.className = 'auth-message error';
            return;
        }
        
        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            registerMessage.textContent = 'Please enter a valid email address';
            registerMessage.className = 'auth-message error';
            return;
        }
        
        // Validate password length
        if (password.length < 8) {
            registerMessage.textContent = 'Password must be at least 8 characters long';
            registerMessage.className = 'auth-message error';
            return;
        }
        
        // Check if passwords match
        if (password !== confirmPassword) {
            registerMessage.textContent = 'Passwords do not match';
            registerMessage.className = 'auth-message error';
            return;
        }
        
        try {
            // Show loading state
            const submitButton = registerForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Registering...';
            submitButton.disabled = true;
            
            // Make API request
            const response = await fetch(`${getApiBaseUrl()}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
            });
            
            const data = await response.json();
            
            // Reset button state
            submitButton.textContent = originalText;
            submitButton.disabled = false;
            
            if (response.ok) {
                // Registration successful
                registerMessage.textContent = 'Registration successful! You can now log in.';
                registerMessage.className = 'auth-message success';
                
                // Clear form
                registerForm.reset();
                
                // Switch to login tab after a short delay
                setTimeout(() => {
                    document.querySelector('.auth-tab[data-tab="login"]').click();
                }, 2000);
            } else {
                // Registration failed
                registerMessage.textContent = data.error || 'Registration failed. Please try again.';
                registerMessage.className = 'auth-message error';
            }
        } catch (error) {
            console.error('Registration error:', error);
            registerMessage.textContent = 'An error occurred. Please try again later.';
            registerMessage.className = 'auth-message error';
            
            // Reset button state
            const submitButton = registerForm.querySelector('button[type="submit"]');
            submitButton.textContent = 'Register';
            submitButton.disabled = false;
        }
    });
    
    // Check if user is already logged in
    const token = localStorage.getItem('duoai_auth_token');
    if (token) {
        // Verify token validity
        fetch(`${getApiBaseUrl()}/verify-token?token=${token}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Token is valid, redirect to main app
                    window.location.href = 'index.html';
                } else {
                    // Token is invalid, clear it
                    localStorage.removeItem('duoai_auth_token');
                    localStorage.removeItem('duoai_username');
                }
            })
            .catch(error => {
                console.error('Token verification error:', error);
                // On error, clear token to be safe
                localStorage.removeItem('duoai_auth_token');
                localStorage.removeItem('duoai_username');
            });
    }
});
