const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const dotenv = require('dotenv');

// Load environment variables from .env file
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    console.log('Loading environment variables from .env file');
    dotenv.config({ path: envPath });
  } else {
    console.log('No .env file found, using environment variables only');
  }
} catch (error) {
  console.error('Error loading .env file:', error);
}

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
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY || '',
  AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  JWT_SECRET: process.env.JWT_SECRET || 'duoai-jwt-secret',
  SESSION_SECRET: process.env.SESSION_SECRET || 'duoai-session-secret',
  API_URL: process.env.API_URL || 'https://duoai.vercel.app'
};

// Load or create configuration
function loadConfig() {
  try {
    // Always use production URL regardless of environment
    const apiUrl = 'https://duoai.vercel.app';
    
    // Load config from file
    let fileConfig = {};
    if (fs.existsSync(configPath)) {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else {
      // Create default config file if it doesn't exist
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    }
    
    // Ensure environment variables take precedence
    const config = { 
      ...defaultConfig, 
      ...fileConfig
    };
    
    // Always set API_URL to production
    config.API_URL = apiUrl;
    
    // Explicitly set environment variables if they exist
    if (process.env.GOOGLE_CLIENT_ID) {
      config.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    }
    
    if (process.env.GOOGLE_CLIENT_SECRET) {
      config.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    }
    
    if (process.env.JWT_SECRET) {
      config.JWT_SECRET = process.env.JWT_SECRET;
    }
    
    // Log available credentials (for debugging)
    console.log('Config loaded:');
    if (config.GOOGLE_CLIENT_ID) console.log('- Google Client ID: ' + maskString(config.GOOGLE_CLIENT_ID));
    if (config.ANTHROPIC_API_KEY) console.log('- Anthropic API Key: ' + maskString(config.ANTHROPIC_API_KEY));
    if (config.ELEVENLABS_API_KEY) console.log('- ElevenLabs API Key: ' + maskString(config.ELEVENLABS_API_KEY));
    if (config.JWT_SECRET) console.log('- JWT Secret: ' + maskString(config.JWT_SECRET));
    console.log('- API URL:', config.API_URL);
    
    return config;
  } catch (error) {
    console.error('Error loading config:', error);
    return { ...defaultConfig, API_URL: 'https://duoai.vercel.app' };
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
    if (config[key] && !process.env[key]) {
      // Only set if not already set from .env file
      process.env[key] = config[key];
    }
  });
  
  // Log available credentials (masked)
  console.log('Environment setup complete:');
  if (process.env.GOOGLE_CLIENT_ID) console.log('- Google Client ID: ' + maskString(process.env.GOOGLE_CLIENT_ID));
  if (process.env.ANTHROPIC_API_KEY) console.log('- Anthropic API Key: ' + maskString(process.env.ANTHROPIC_API_KEY));
  if (process.env.ELEVENLABS_API_KEY) console.log('- ElevenLabs API Key: ' + maskString(process.env.ELEVENLABS_API_KEY));
  if (process.env.JWT_SECRET) console.log('- JWT Secret: ' + maskString(process.env.JWT_SECRET));
}

// Helper function to mask sensitive strings
function maskString(str) {
  if (!str) return 'not set';
  if (str.length <= 8) return '****';
  return str.substring(0, 4) + '...' + str.substring(str.length - 4);
}

module.exports = {
  loadConfig,
  saveConfig,
  setupEnv
};
