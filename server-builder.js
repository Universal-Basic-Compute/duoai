const { exec } = require('pkg');
const path = require('path');
const fs = require('fs');

async function buildServer() {
  try {
    console.log('Building server executable...');
    
    // Create a temporary package.json for the server
    const serverPkg = {
      name: "duoai-server",
      version: "1.0.0",
      description: "DUOAI Server",
      main: "server.js",
      bin: {
        "duoai-server": "./server.js"
      },
      dependencies: {
        "airtable": "^0.12.2",
        "cors": "^2.8.5",
        "dotenv": "^16.4.7",
        "elevenlabs": "^0.2.1",
        "express": "^4.21.2",
        "express-session": "^1.18.1",
        "multer": "^1.4.5-lts.1",
        "passport": "^0.7.0",
        "passport-google-oauth20": "^2.0.0",
        "sharp": "^0.33.5"
      }
    };
    
    fs.writeFileSync('server-package.json', JSON.stringify(serverPkg, null, 2));
    
    // Create dist/server directory if it doesn't exist
    if (!fs.existsSync('dist/server')) {
      fs.mkdirSync('dist/server', { recursive: true });
    }
    
    // Build the server executable
    await exec([
      'server.js',
      '--target', 'node18-win-x64',  // Only build for the current platform
      '--output', 'dist/server/duoai-server.exe'  // Explicitly add .exe extension
    ]);
    
    console.log('Server executable built successfully!');
    
    // Clean up
    fs.unlinkSync('server-package.json');
  } catch (error) {
    console.error('Error building server:', error);
  }
}

buildServer();
