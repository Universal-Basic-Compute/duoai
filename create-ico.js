const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const buildDir = path.join(__dirname, 'build');
const pngPath = path.join(buildDir, 'icon.png');
const icoPath = path.join(buildDir, 'icon.ico');

// Create build directory if it doesn't exist
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Check if PNG exists
if (!fs.existsSync(pngPath)) {
  console.log('PNG icon not found, creating a placeholder...');
  
  // Create a simple placeholder icon
  sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 26, g: 26, b: 26, alpha: 1 }
    }
  })
  .composite([
    {
      input: Buffer.from(
        `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
          <rect width="512" height="512" fill="#1a1a1a"/>
          <text x="256" y="256" font-family="Arial" font-size="200" fill="white" text-anchor="middle" dominant-baseline="middle">D</text>
        </svg>`
      ),
      top: 0,
      left: 0
    }
  ])
  .toFile(pngPath)
  .then(() => {
    console.log('Created placeholder PNG icon at:', pngPath);
    createIcoFromPng();
  })
  .catch(err => {
    console.error('Failed to create placeholder PNG icon:', err);
    process.exit(1);
  });
} else {
  createIcoFromPng();
}

function createIcoFromPng() {
  try {
    // For simplicity, we'll create multiple sizes and use the 256x256 as the ICO
    // In a real app, you'd want to use a proper ICO converter library
    const sizes = [16, 32, 48, 64, 128, 256];
    const promises = [];
    
    // Create a temp directory for the resized images
    const tempDir = path.join(buildDir, 'temp-icons');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create different sizes
    for (const size of sizes) {
      const resizedPath = path.join(tempDir, `icon-${size}.png`);
      promises.push(
        sharp(pngPath)
          .resize(size, size)
          .toFile(resizedPath)
          .then(() => console.log(`Created ${size}x${size} icon`))
      );
    }
    
    // When all sizes are created, use the 256x256 as our ICO
    Promise.all(promises)
      .then(() => {
        const ico256Path = path.join(tempDir, 'icon-256.png');
        fs.copyFileSync(ico256Path, icoPath);
        console.log('Created ICO file at:', icoPath, '(Note: This is actually a PNG file renamed to .ico)');
        
        // Clean up temp directory
        try {
          for (const size of sizes) {
            fs.unlinkSync(path.join(tempDir, `icon-${size}.png`));
          }
          fs.rmdirSync(tempDir);
        } catch (cleanupErr) {
          console.warn('Could not clean up temp directory:', cleanupErr.message);
        }
      })
      .catch(err => {
        console.error('Error creating ICO file:', err);
        // Fallback: just copy the original PNG as ICO
        fs.copyFileSync(pngPath, icoPath);
        console.log('Created fallback ICO file (copied from PNG)');
      });
  } catch (error) {
    console.error('Error in createIcoFromPng:', error);
    // Last resort fallback
    try {
      fs.copyFileSync(pngPath, icoPath);
      console.log('Created emergency fallback ICO file');
    } catch (fallbackError) {
      console.error('Critical error: Could not create ICO file:', fallbackError);
    }
  }
}
