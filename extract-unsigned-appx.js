const fs = require('fs');
const path = require('path');

// Path to the built APPX file
const distDir = path.join(__dirname, 'dist');
const appxFiles = fs.readdirSync(distDir).filter(file => file.endsWith('.appx'));

if (appxFiles.length === 0) {
  console.error('No .appx files found in the dist directory');
  process.exit(1);
}

// Find the original APPX file (usually the first one without "unsigned" in the name)
const originalAppx = appxFiles.find(file => !file.includes('unsigned'));
if (!originalAppx) {
  console.error('Could not find the original APPX file in the dist directory');
  process.exit(1);
}

const appxPath = path.join(distDir, originalAppx);
const targetPath = path.join(distDir, 'DUOAI-0.1.0-unsigned.appx');

console.log('Checking for APPX file...');
console.log(`Found APPX file at: ${appxPath}`);

try {
  // Copy the file to a new location
  fs.copyFileSync(appxPath, targetPath);
  console.log(`Successfully copied to: ${targetPath}`);
  console.log('This unsigned APPX file is ready for Windows Store submission.');
  console.log('\nFor Windows Store submission:');
  console.log('1. Use this unsigned APPX file');
  console.log('2. Microsoft will sign it during the submission process');
  console.log('3. Make sure your AppxManifest.xml identity matches your Partner Center registration');
} catch (error) {
  console.error(`Error copying APPX file: ${error.message}`);
}
