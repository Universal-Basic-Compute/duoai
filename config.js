const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Get the app data directory
const getUserDataPath = () => {
  // Handle case when app is not available (e.g., when required from server.js)
  if (app) {
    return app.getPath('userData');
  }
  // Fallback for when running outside Electron context
  const homePath = require('os').homedir();
  
  if (process.platform === 'win32') {
    return path.join(homePath, 'AppData', 'Roaming', 'duoai');
  } else if (process.platform === 'darwin') {
    return path.join(homePath, 'Library', 'Application Support', 'duoai');
  } else {
    return path.join(homePath, '.config', 'duoai');
  }
};

const userDataPath = getUserDataPath();
const configPath = path.join(userDataPath, 'config.json');

// Ensure the directory exists
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

// Default configuration
const defaultConfig = {
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  AIRTABLE_API_KEY: '',
  AIRTABLE_BASE_ID: '',
  ANTHROPIC_API_KEY: '',
  ELEVENLABS_API_KEY: '',
  SESSION_SECRET: 'duoai-session-secret'
};

// Load or create configuration
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ...defaultConfig, ...config };
    }
    
    // Create default config file if it doesn't exist
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  } catch (error) {
    console.error('Error loading config:', error);
    return defaultConfig;
  }
}

// Save configuration
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// Export environment variables
function setupEnv() {
  const config = loadConfig();
  
  // Set environment variables
  Object.keys(config).forEach(key => {
    if (config[key]) {
      process.env[key] = config[key];
    }
  });
}

module.exports = {
  loadConfig,
  saveConfig,
  setupEnv
};
