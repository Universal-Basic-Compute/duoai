const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

console.log('Creating ICO file from SVG logo...');

// Define paths
const sourceIcon = path.join(__dirname, 'svg', 'Icon.svg');
const buildDir = path.join(__dirname, 'build');
const pngPath = path.join(buildDir, 'icon.png');
const icoPath = path.join(buildDir, 'icon.ico');

// Create build directory if it doesn't exist
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Check if the source icon exists
if (!fs.existsSync(sourceIcon)) {
  console.error('Source SVG logo not found at:', sourceIcon);
  console.error('Looking for alternative sources...');
  
  // Try other potential locations
  const alternativeSources = [
    path.join(__dirname, 'website', 'images', 'logo.svg'),
    path.join(__dirname, 'assets', 'logo.svg'),
    path.join(__dirname, 'images', 'logo.svg'),
    path.join(__dirname, 'svg', 'Square150x150Logo.svg')
  ];
  
  let foundSource = null;
  for (const source of alternativeSources) {
    if (fs.existsSync(source)) {
      console.log('Found alternative source at:', source);
      foundSource = source;
      break;
    }
  }
  
  if (foundSource) {
    // Use the alternative source
    createPngFromSvg(foundSource);
  } else {
    // Create a fallback icon if no SVG is found
    console.log('Creating a fallback icon...');
    
    sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 26, g: 26, b: 42, alpha: 1 } // #1a1a2e
      }
    })
    .composite([
      {
        input: Buffer.from(
          `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
            <rect width="512" height="512" fill="#1a1a2e"/>
            <text x="256" y="256" font-family="Arial" font-size="200" font-weight="bold" fill="#4a4ae6" text-anchor="middle" dominant-baseline="middle">D</text>
            <text x="256" y="400" font-family="Arial" font-size="100" font-weight="bold" fill="#e64a8c" text-anchor="middle" dominant-baseline="middle">AI</text>
          </svg>`
        ),
        top: 0,
        left: 0
      }
    ])
    .toFile(pngPath)
    .then(() => {
      console.log('Created fallback PNG icon at:', pngPath);
      createIcoFromPng();
    })
    .catch(err => {
      console.error('Failed to create fallback PNG icon:', err);
      process.exit(1);
    });
  }
} else {
  // Use the SVG logo
  createPngFromSvg(sourceIcon);
}

function createPngFromSvg(svgPath) {
  console.log('Creating icon from SVG logo:', svgPath);
  
  // Create a high-quality PNG from the SVG
  sharp(svgPath)
    .resize(512, 512)
    .toFile(pngPath)
    .then(() => {
      console.log('Created PNG icon from SVG at:', pngPath);
      createIcoFromPng();
    })
    .catch(err => {
      console.error('Failed to create PNG from SVG:', err);
      process.exit(1);
    });
}

function createIcoFromPng() {
  try {
    // Create a temp directory for the resized images
    const tempDir = path.join(buildDir, 'temp-icons');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create different sizes
    const sizes = [16, 32, 48, 64, 128, 256];
    const promises = [];
    
    for (const size of sizes) {
      const resizedPath = path.join(tempDir, `icon-${size}.png`);
      promises.push(
        sharp(pngPath)
          .resize(size, size)
          .toFile(resizedPath)
          .then(() => console.log(`Created ${size}x${size} icon`))
      );
    }
    
    // When all sizes are created, try to use a proper ICO converter if available
    Promise.all(promises)
      .then(() => {
        try {
          // Try to use the png-to-ico npm package if it's installed
          const pngToIco = require('png-to-ico');
          
          // Create an array of file paths for all sizes
          const files = sizes.map(size => path.join(tempDir, `icon-${size}.png`));
          
          pngToIco(files)
            .then(buf => {
              fs.writeFileSync(icoPath, buf);
              console.log('Created proper multi-size ICO file at:', icoPath);
              
              // Clean up temp directory
              cleanupTempDir();
            })
            .catch(err => {
              console.warn('Error using png-to-ico:', err.message);
              fallbackIcoCreation();
            });
        } catch (err) {
          console.warn('png-to-ico package not available:', err.message);
          fallbackIcoCreation();
        }
      })
      .catch(err => {
        console.error('Error creating icon sizes:', err);
        fallbackIcoCreation();
      });
      
    function fallbackIcoCreation() {
      // Fallback: just use the 256x256 PNG as ICO
      console.log('Using fallback ICO creation method');
      fs.copyFileSync(path.join(tempDir, 'icon-256.png'), icoPath);
      console.log('Created ICO file at:', icoPath, '(Note: This is actually a PNG file renamed to .ico)');
      
      // Clean up temp directory
      cleanupTempDir();
    }
    
    function cleanupTempDir() {
      try {
        for (const size of sizes) {
          fs.unlinkSync(path.join(tempDir, `icon-${size}.png`));
        }
        fs.rmdirSync(tempDir);
      } catch (cleanupErr) {
        console.warn('Could not clean up temp directory:', cleanupErr.message);
      }
    }
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
