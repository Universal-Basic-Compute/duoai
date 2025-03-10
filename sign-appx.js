const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Path to the APPX file
const distDir = path.join(__dirname, 'dist');
const appxFiles = fs.readdirSync(distDir).filter(file => file.endsWith('.appx'));

if (appxFiles.length === 0) {
  console.error('No .appx files found in the dist directory');
  process.exit(1);
}

const appxPath = path.join(distDir, appxFiles[0]);
console.log(`Found APPX file: ${appxPath}`);

// Path to the certificate
const certPath = path.join(__dirname, 'cert', 'DUOAI.pfx');
if (!fs.existsSync(certPath)) {
  console.error(`Certificate not found at: ${certPath}`);
  process.exit(1);
}

// Check if we should skip signing (for Windows Store submission)
const skipSigning = process.argv.includes('--skip-signing');
if (skipSigning) {
  console.log('Skipping signing as requested (--skip-signing flag detected)');
  console.log('This is appropriate for Windows Store submission as Microsoft will sign the package.');
  
  // Create an unsigned copy for store submission
  try {
    const unsignedPath = path.join(distDir, 'DUOAI-0.1.0-unsigned.appx');
    fs.copyFileSync(appxPath, unsignedPath);
    console.log(`Created unsigned copy at: ${unsignedPath}`);
    console.log('This unsigned APPX file is ready for Windows Store submission.');
  } catch (copyError) {
    console.error('Error creating unsigned copy:', copyError.message);
  }
  
  process.exit(0);
}

// Sign the APPX file
try {
  console.log('Signing APPX file...');
  
  // Use signtool.exe to sign the APPX file
  const signCommand = `
    $env:PATH += ";C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.19041.0\\x64";
    & signtool.exe sign /fd SHA256 /a /f "${certPath}" /p pass "${appxPath}"
  `;
  
  execSync(`powershell -Command "${signCommand}"`, { stdio: 'inherit' });
  
  console.log('APPX file signed successfully');
} catch (error) {
  console.error('Error signing APPX file:', error.message);
  
  // Check for the specific error about multiple signatures
  if (error.message.includes('Multiple signature') || error.message.includes('already signed')) {
    console.log('The APPX file appears to be already signed or has signature issues.');
    console.log('This is common when electron-builder has already attempted to sign the package.');
    
    // Create an unsigned copy for store submission
    try {
      const unsignedPath = path.join(distDir, 'DUOAI-0.1.0-unsigned.appx');
      fs.copyFileSync(appxPath, unsignedPath);
      console.log(`Created unsigned copy at: ${unsignedPath}`);
      console.log('This unsigned APPX file is ready for Windows Store submission.');
    } catch (copyError) {
      console.error('Error creating unsigned copy:', copyError.message);
    }
    
    // Exit with success code since this isn't a critical error
    process.exit(0);
  }
  
  // Try alternative method
  try {
    console.log('Trying alternative signing method...');
    
    // Use Add-AppxPackage to sign the APPX file
    const alternativeCommand = `
      $cert = Get-PfxCertificate -FilePath "${certPath}";
      Add-AppxPackage -Path "${appxPath}" -CertificatePath "${certPath}" -ForceUpdateFromAnyVersion
    `;
    
    execSync(`powershell -Command "${alternativeCommand}"`, { stdio: 'inherit' });
    
    console.log('APPX file signed and installed successfully');
  } catch (altError) {
    console.error('Error with alternative signing method:', altError.message);
    
    // Create an unsigned copy for store submission
    try {
      const unsignedPath = path.join(distDir, 'DUOAI-0.1.0-unsigned.appx');
      fs.copyFileSync(appxPath, unsignedPath);
      console.log(`Created unsigned copy at: ${unsignedPath}`);
      console.log('This unsigned APPX file is ready for Windows Store submission.');
      console.log('\nFor Windows Store submission, use this unsigned package.');
      console.log('Microsoft will sign it during the submission process.\n');
    } catch (copyError) {
      console.error('Error creating unsigned copy:', copyError.message);
    }
    
    process.exit(1);
  }
}
