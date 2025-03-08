const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('DUOAI Diagnostic Tool');
console.log('====================');
console.log(`Running at: ${new Date().toISOString()}`);
console.log(`Platform: ${process.platform} (${os.release()})`);
console.log(`Architecture: ${process.arch}`);
console.log(`Node.js version: ${process.version}`);
console.log(`Current directory: ${__dirname}`);

// Check for critical files
console.log('\nChecking for critical files:');
const criticalFiles = [
    'main.js',
    'renderer.js',
    'config.js',
    'index.html',
    'package.json',
    'node_modules/electron/package.json',
    'bridge.js',
    'speech.js'
];

criticalFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    const exists = fs.existsSync(filePath);
    console.log(`- ${file}: ${exists ? 'Found' : 'MISSING'}`);
    
    if (exists) {
        try {
            const stats = fs.statSync(filePath);
            console.log(`  - Size: ${stats.size} bytes`);
            console.log(`  - Last modified: ${stats.mtime}`);
        } catch (e) {
            console.log(`  - Error reading file stats: ${e.message}`);
        }
    }
});

// Check for .env file
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);
console.log(`\n.env file: ${envExists ? 'Found' : 'MISSING'}`);

if (envExists) {
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envLines = envContent.split('\n');
        console.log('- Environment variables defined:');
        envLines.forEach(line => {
            if (line.trim() && !line.startsWith('#')) {
                const parts = line.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    console.log(`  - ${key}: Defined`);
                }
            }
        });
    } catch (e) {
        console.log(`- Error reading .env file: ${e.message}`);
    }
}

// Check for log files
console.log('\nChecking for log files:');
const possibleLogPaths = [
    path.join(__dirname, 'duoai-error.log'),
    path.join(__dirname, 'error.log'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'duoai', 'error.log'),
    path.join(os.homedir(), 'AppData', 'Local', 'duoai', 'error.log')
];

possibleLogPaths.forEach(logPath => {
    const exists = fs.existsSync(logPath);
    console.log(`- ${logPath}: ${exists ? 'Found' : 'Not found'}`);
    
    if (exists) {
        try {
            const stats = fs.statSync(logPath);
            console.log(`  - Size: ${stats.size} bytes`);
            console.log(`  - Last modified: ${stats.mtime}`);
            
            if (stats.size > 0) {
                const content = fs.readFileSync(logPath, 'utf8');
                const lines = content.split('\n');
                console.log(`  - Last 10 lines:`);
                lines.slice(-10).forEach(line => {
                    console.log(`    ${line}`);
                });
            }
        } catch (e) {
            console.log(`  - Error reading log: ${e.message}`);
        }
    }
});

// Check for dependencies
console.log('\nChecking for critical dependencies:');
const criticalDeps = [
    'electron',
    'axios',
    'dotenv',
    'jsonwebtoken',
    'sharp',
    'elevenlabs'
];

criticalDeps.forEach(dep => {
    try {
        const depPath = require.resolve(dep);
        console.log(`- ${dep}: Found at ${depPath}`);
    } catch (e) {
        console.log(`- ${dep}: MISSING (${e.message})`);
    }
});

// Check for user data directory
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'duoai');
console.log(`\nUser data directory (${userDataPath}): ${fs.existsSync(userDataPath) ? 'Exists' : 'Does not exist'}`);

// Check protocol handler registration
console.log('\nChecking protocol handler registration:');
try {
    const { execSync } = require('child_process');
    const command = 'reg query "HKCU\\Software\\Classes\\duoai" /s';
    const result = execSync(command, { encoding: 'utf8' });
    console.log('Protocol handler registration found:');
    console.log(result);
} catch (error) {
    console.log('Protocol handler not registered in Windows registry');
    console.log('Error:', error.message);
}

if (fs.existsSync(userDataPath)) {
    try {
        const files = fs.readdirSync(userDataPath);
        console.log('- Files in user data directory:');
        files.forEach(file => {
            console.log(`  - ${file}`);
        });
    } catch (e) {
        console.log(`- Error reading user data directory: ${e.message}`);
    }
}

// Check for config file
const configPath = path.join(userDataPath, 'config.json');
console.log(`\nConfig file (${configPath}): ${fs.existsSync(configPath) ? 'Exists' : 'Does not exist'}`);

if (fs.existsSync(configPath)) {
    try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent);
        console.log('- Config contents:');
        Object.keys(config).forEach(key => {
            const value = config[key];
            const displayValue = typeof value === 'string' && value.length > 10 
                ? value.substring(0, 5) + '...' + value.substring(value.length - 5)
                : value;
            console.log(`  - ${key}: ${displayValue}`);
        });
    } catch (e) {
        console.log(`- Error reading config file: ${e.message}`);
    }
}

console.log('\nDiagnostic complete.');
