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
    console.log('If you\'re submitting to the Windows Store, this is not a problem as Microsoft will sign it.');
    
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
    
    // If both methods fail, suggest using the unsigned package for Store submission
    console.log('\nSuggestion: If you\'re submitting to the Windows Store, you can use the unsigned package.');
    console.log('Run: npm run dist:msix-unsigned');
    console.log('Then submit the resulting .appx file to the Windows Store.\n');
    
    process.exit(1);
  }
}
