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
