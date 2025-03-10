const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create directory for certificate if it doesn't exist
const certDir = path.join(__dirname, 'cert');
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

const pfxPath = path.join(certDir, 'DUOAI.pfx');
const publisherName = 'CN=DUOAI Technologies';

// Check if certificate already exists
if (fs.existsSync(pfxPath)) {
  console.log(`Certificate already exists at: ${pfxPath}`);
  process.exit(0);
}

console.log('Creating self-signed certificate for MSIX packaging...');

// Check if OpenSSL is available for non-Windows platforms
function checkOpenSSL() {
  try {
    if (process.platform !== 'win32') {
      execSync('openssl version', { stdio: 'pipe' });
      return true;
    }
    return false;
  } catch (error) {
    console.warn('OpenSSL not found. Will try alternative methods.');
    return false;
  }
}

// Create a dummy certificate if we can't create a real one
function createDummyCertificate() {
  console.log('Creating a dummy certificate for development purposes...');
  
  try {
    // Create a simple text file as a placeholder
    const dummyContent = `
      This is a dummy certificate file for development purposes only.
      Created: ${new Date().toISOString()}
      This file should be replaced with a real certificate for production builds.
    `;
    
    fs.writeFileSync(pfxPath, dummyContent);
    console.log(`Dummy certificate created at: ${pfxPath}`);
    
    // Also update the package.json to use a dummy publisher
    try {
      const packageJsonPath = path.join(__dirname, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        if (packageJson.build && packageJson.build.msix) {
          // Save the original publisher for reference
          const originalPublisher = packageJson.build.msix.publisher;
          packageJson.build.msix._originalPublisher = originalPublisher;
          
          // Set a dummy publisher that doesn't require a real certificate
          packageJson.build.msix.publisher = "CN=DummyPublisher";
          
          fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
          console.log('Updated package.json with dummy publisher for development');
        }
      }
    } catch (packageError) {
      console.warn('Could not update package.json:', packageError.message);
    }
    
    return true;
  } catch (error) {
    console.error('Error creating dummy certificate:', error);
    return false;
  }
}

try {
  // For Windows, use PowerShell to create a self-signed certificate
  if (process.platform === 'win32') {
    try {
      const powershellCommand = `
        $cert = New-SelfSignedCertificate -Type Custom -Subject "${publisherName}" -KeyUsage DigitalSignature -FriendlyName "DUOAI Development Certificate" -CertStoreLocation "Cert:\\CurrentUser\\My" -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")
        $password = ConvertTo-SecureString -String "" -Force -AsPlainText
        Export-PfxCertificate -Cert $cert -FilePath "${pfxPath.replace(/\\/g, '\\\\')}" -Password $password
        Write-Host "Certificate thumbprint: " $cert.Thumbprint
      `;
      
      execSync(`powershell -Command "${powershellCommand}"`, { stdio: 'inherit' });
      console.log(`Certificate created successfully at: ${pfxPath}`);
    } catch (winError) {
      console.error('Error creating certificate with PowerShell:', winError.message);
      console.log('Trying alternative method...');
      
      if (!createDummyCertificate()) {
        throw new Error('Failed to create certificate using any method');
      }
    }
  } 
  // For macOS and Linux, use OpenSSL if available
  else if (checkOpenSSL()) {
    // Create temp directory for certificate files
    const keyPath = path.join(certDir, 'private.key');
    const crtPath = path.join(certDir, 'certificate.crt');
    
    try {
      // Generate private key
      execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'inherit' });
      
      // Generate certificate
      execSync(`openssl req -new -x509 -key "${keyPath}" -out "${crtPath}" -days 365 -subj "/CN=DUOAI Technologies" -nodes`, { stdio: 'inherit' });
      
      // Create PFX file with empty password
      execSync(`openssl pkcs12 -export -out "${pfxPath}" -inkey "${keyPath}" -in "${crtPath}" -passout pass:`, { stdio: 'inherit' });
      
      console.log(`Certificate created successfully at: ${pfxPath}`);
    } catch (opensslError) {
      console.error('Error using OpenSSL:', opensslError.message);
      
      if (!createDummyCertificate()) {
        throw new Error('Failed to create certificate using any method');
      }
    }
  }
  // If no other method works, create a dummy certificate
  else {
    if (!createDummyCertificate()) {
      throw new Error('Failed to create certificate using any method');
    }
  }
} catch (error) {
  console.error('Error creating certificate:', error);
  console.log('Creating a dummy certificate as fallback...');
  
  if (!createDummyCertificate()) {
    console.error('CRITICAL: Could not create even a dummy certificate. MSIX packaging will fail.');
    process.exit(1);
  }
}
