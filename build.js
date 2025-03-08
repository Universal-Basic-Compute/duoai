const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure the build directory exists
const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Check if icon exists, if not create a placeholder
const iconPath = path.join(buildDir, 'icon.ico');
if (!fs.existsSync(iconPath)) {
  console.warn('Warning: No icon.ico found in build directory. Please add one for a proper application icon.');
}

// Run the build process
console.log('Building DUOAI application...');

try {
  // First build Next.js static files if needed
  // execSync('npm run build', { stdio: 'inherit' });
  
  // Then build the Electron app
  execSync('npm run dist', { stdio: 'inherit' });
  
  console.log('Build completed successfully! Check the dist folder for your executable.');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
