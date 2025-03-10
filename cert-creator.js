const { execSync } = require('child_process');
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

try {
  // For Windows, use PowerShell to create a self-signed certificate
  if (process.platform === 'win32') {
    const powershellCommand = `
      $cert = New-SelfSignedCertificate -Type Custom -Subject "${publisherName}" -KeyUsage DigitalSignature -FriendlyName "DUOAI Development Certificate" -CertStoreLocation "Cert:\\CurrentUser\\My" -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")
      $password = ConvertTo-SecureString -String "" -Force -AsPlainText
      Export-PfxCertificate -Cert $cert -FilePath "${pfxPath.replace(/\\/g, '\\\\')}" -Password $password
      Write-Host "Certificate thumbprint: " $cert.Thumbprint
    `;
    
    execSync(`powershell -Command "${powershellCommand}"`, { stdio: 'inherit' });
    console.log(`Certificate created successfully at: ${pfxPath}`);
  } 
  // For macOS, use OpenSSL
  else if (process.platform === 'darwin') {
    // Generate private key
    execSync(`openssl genrsa -out ${path.join(certDir, 'private.key')} 2048`, { stdio: 'inherit' });
    
    // Generate certificate
    execSync(`openssl req -new -x509 -key ${path.join(certDir, 'private.key')} -out ${path.join(certDir, 'certificate.crt')} -days 365 -subj "/CN=DUOAI Technologies"`, { stdio: 'inherit' });
    
    // Create PFX file
    execSync(`openssl pkcs12 -export -out "${pfxPath}" -inkey ${path.join(certDir, 'private.key')} -in ${path.join(certDir, 'certificate.crt')} -passout pass:`, { stdio: 'inherit' });
    
    console.log(`Certificate created successfully at: ${pfxPath}`);
  }
  // For Linux, also use OpenSSL
  else {
    // Generate private key
    execSync(`openssl genrsa -out ${path.join(certDir, 'private.key')} 2048`, { stdio: 'inherit' });
    
    // Generate certificate
    execSync(`openssl req -new -x509 -key ${path.join(certDir, 'private.key')} -out ${path.join(certDir, 'certificate.crt')} -days 365 -subj "/CN=DUOAI Technologies"`, { stdio: 'inherit' });
    
    // Create PFX file
    execSync(`openssl pkcs12 -export -out "${pfxPath}" -inkey ${path.join(certDir, 'private.key')} -in ${path.join(certDir, 'certificate.crt')} -passout pass:`, { stdio: 'inherit' });
    
    console.log(`Certificate created successfully at: ${pfxPath}`);
  }
} catch (error) {
  console.error('Error creating certificate:', error);
  process.exit(1);
}
