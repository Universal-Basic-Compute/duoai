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
    
    // Copy API directory to dist/server
    if (fs.existsSync('api')) {
      if (!fs.existsSync('dist/server/api')) {
        fs.mkdirSync('dist/server/api', { recursive: true });
      }
      
      // Copy all files from api directory
      const apiFiles = fs.readdirSync('api', { withFileTypes: true });
      for (const file of apiFiles) {
        if (file.isDirectory()) {
          // Handle subdirectories
          const subdir = path.join('api', file.name);
          const targetSubdir = path.join('dist/server/api', file.name);
          
          if (!fs.existsSync(targetSubdir)) {
            fs.mkdirSync(targetSubdir, { recursive: true });
          }
          
          const subdirFiles = fs.readdirSync(subdir);
          for (const subFile of subdirFiles) {
            const source = path.join(subdir, subFile);
            const target = path.join(targetSubdir, subFile);
            fs.copyFileSync(source, target);
          }
        } else if (file.name !== 'package.json') {
          // Copy file, but skip the api-specific package.json
          const source = path.join('api', file.name);
          const target = path.join('dist/server/api', file.name);
          fs.copyFileSync(source, target);
        }
      }
      
      console.log('API directory copied to dist/server/api');
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
