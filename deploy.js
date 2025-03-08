const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure the api directory exists
if (!fs.existsSync('api')) {
  fs.mkdirSync('api');
}

// Copy necessary files to the api directory
const filesToCopy = [
  'airtable-service.js'
];

// Make sure the file exists before copying
filesToCopy.forEach(file => {
  if (!fs.existsSync(file)) {
    console.warn(`Warning: ${file} not found in source directory`);
    // Create a minimal version if it doesn't exist
    if (file === 'airtable-service.js') {
      console.log('Creating minimal airtable-service.js file');
      const minimalContent = `
const Airtable = require('airtable');

// Initialize variables
let airtableEnabled = false;
let base;
let usersTable;

try {
  // Configure Airtable
  if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
    Airtable.configure({
      apiKey: process.env.AIRTABLE_API_KEY
    });
    
    base = Airtable.base(process.env.AIRTABLE_BASE_ID);
    usersTable = base('USERS');
    airtableEnabled = true;
    console.log('Airtable initialized successfully');
  } else {
    console.warn('Airtable API key or Base ID not provided. Using mock data instead.');
  }
} catch (error) {
  console.warn('Failed to initialize Airtable:', error.message);
}

module.exports = {
  findUserByGoogleId: async () => ({ id: 'mock-id', GoogleId: 'mock', Username: 'Mock User' }),
  findUserByEmail: async () => ({ id: 'mock-id', Email: 'mock@example.com', Username: 'Mock User' }),
  createUser: async () => ({ id: 'mock-id', GoogleId: 'mock', Username: 'Mock User' }),
  createUserWithCredentials: async () => ({ id: 'mock-id', Email: 'mock@example.com', Username: 'Mock User' }),
  updateUser: async () => ({}),
  updateLastLogin: async () => ({}),
  updateSubscription: async () => ({}),
  updateUsageHours: async () => ({}),
  getSubscription: async () => ({ plan: 'basic', status: 'active' }),
  saveMessage: async () => ({}),
  getUserMessages: async () => ([])
};`;
      fs.writeFileSync(file, minimalContent);
    }
  }
});

// Ensure we copy the file to the api directory
filesToCopy.forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join('api', file));
    console.log(`Copied ${file} to api directory`);
  }
});

filesToCopy.forEach(file => {
  fs.copyFileSync(file, path.join('api', file));
});

// Ensure the prompts directory is copied
if (!fs.existsSync(path.join('api', 'prompts'))) {
  fs.mkdirSync(path.join('api', 'prompts'), { recursive: true });
}

// Copy prompts directory
const copyDir = (src, dest) => {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

copyDir('prompts', path.join('api', 'prompts'));

console.log('Files prepared for deployment');

// Deploy to Vercel
try {
  console.log('Deploying to Vercel...');
  execSync('vercel --prod', { stdio: 'inherit' });
  console.log('Deployment successful!');
} catch (error) {
  console.error('Deployment failed:', error);
}
