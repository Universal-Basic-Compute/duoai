const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

console.log('Starting Electron app...');

// Get the absolute path to the main.js file
const mainPath = path.resolve(__dirname, 'main.js');
console.log('Main file path:', mainPath);

// Check if the file exists
const fs = require('fs');
if (!fs.existsSync(mainPath)) {
    console.error(`Error: main.js not found at ${mainPath}`);
    process.exit(1);
}

// Start Electron with the current directory
const electronProcess = spawn(electron, [__dirname], { 
    stdio: 'inherit',
    env: {
        ...process.env,
        ELECTRON_ENABLE_LOGGING: 1,
        NODE_ENV: 'development',
        ELECTRON_START_URL: 'file://' + path.join(__dirname, 'index.html')
    }
});

console.log('Electron process started with PID:', electronProcess.pid);

electronProcess.on('close', (code) => {
    console.log(`Electron process exited with code ${code}`);
    process.exit(code);
});

electronProcess.on('error', (err) => {
    console.error('Failed to start Electron process:', err);
    process.exit(1);
});
