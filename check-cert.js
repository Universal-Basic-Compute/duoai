const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define the certificate path
const certPath = path.join(__dirname, 'cert', 'DUOAI.pfx');

console.log('Checking for certificate file...');

// Check if certificate exists
if (fs.existsSync(certPath)) {
  console.log(`Certificate already exists at: ${certPath}`);
} else {
  console.log(`Certificate not found at: ${certPath}`);
  console.log('Running cert-creator.js to generate certificate...');
  
  try {
    // Run the certificate creator script
    execSync('node cert-creator.js', { stdio: 'inherit' });
    
    // Verify the certificate was created
    if (fs.existsSync(certPath)) {
      console.log(`Certificate successfully created at: ${certPath}`);
    } else {
      console.error(`ERROR: Certificate still not found at: ${certPath} after running cert-creator.js`);
      console.error('Please check the cert-creator.js output for errors.');
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error running cert-creator.js: ${error.message}`);
    process.exit(1);
  }
}

console.log('Certificate check completed.');
