const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

console.log('Starting Electron app...');

// Get the path to the electron executable
const electronPath = electron;

// Start Electron with the current directory
const electronProcess = spawn(electronPath, ['.'], { 
    stdio: 'inherit',
    env: {
        ...process.env,
        ELECTRON_START_URL: 'file://' + path.join(__dirname, 'index.html')
    }
});

electronProcess.on('close', (code) => {
    console.log(`Electron process exited with code ${code}`);
    process.exit(code);
});

console.log('Electron process started');
