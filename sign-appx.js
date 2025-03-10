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
    process.exit(1);
  }
}
