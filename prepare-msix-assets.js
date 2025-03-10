const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Define the assets directory
const assetsDir = path.join(__dirname, 'assets');

// Create the assets directory if it doesn't exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Define the source icon path
const sourceIcon = path.join(__dirname, 'build', 'icon.png');

// Check if the source icon exists
if (!fs.existsSync(sourceIcon)) {
  console.error('Source icon not found at:', sourceIcon);
  console.error('Please ensure you have a high-resolution icon.png file in the build directory');
  process.exit(1);
}

// Define the required assets with their sizes
const requiredAssets = [
  { name: 'Square44x44Logo.png', width: 44, height: 44 },
  { name: 'Square150x150Logo.png', width: 150, height: 150 },
  { name: 'Wide310x150Logo.png', width: 310, height: 150 },
  { name: 'LargeTile.png', width: 310, height: 310 },
  { name: 'SmallTile.png', width: 71, height: 71 },
  { name: 'StoreLogo.png', width: 50, height: 50 },
  { name: 'SplashScreen.png', width: 620, height: 300 },
  { name: 'BadgeLogo.png', width: 24, height: 24 }
];

// Function to resize an image
async function resizeImage(source, target, width, height) {
  try {
    await sharp(source)
      .resize(width, height)
      .toFile(target);
    console.log(`Created ${target}`);
  } catch (error) {
    console.error(`Error creating ${target}:`, error);
  }
}

// Process each required asset
async function processAssets() {
  console.log('Preparing MSIX assets...');
  
  try {
    // Process all the standard assets
    for (const asset of requiredAssets) {
      const targetPath = path.join(assetsDir, asset.name);
      await resizeImage(sourceIcon, targetPath, asset.width, asset.height);
    }
    
    // Create a special splash screen with text
    try {
      // Create a blank canvas for the splash screen
      const splashPath = path.join(assetsDir, 'SplashScreen.png');
      
      // Use a different approach for the splash screen - create a colored background with text
      await sharp({
        create: {
          width: 620,
          height: 300,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 1 }
        }
      })
      .composite([
        {
          input: Buffer.from(
            `<svg width="620" height="300" xmlns="http://www.w3.org/2000/svg">
              <rect width="620" height="300" fill="#1a1a1a"/>
              <text x="310" y="120" font-family="Arial" font-size="48" fill="white" text-anchor="middle">DUOAI</text>
              <text x="310" y="180" font-family="Arial" font-size="24" fill="#cccccc" text-anchor="middle">Your Intelligent Gaming Companion</text>
            </svg>`
          ),
          top: 0,
          left: 0
        }
      ])
      .toFile(splashPath);
      
      console.log(`Created custom ${splashPath}`);
      
      // Also create a store logo with a solid background
      const storeLogoPath = path.join(assetsDir, 'StoreLogo.png');
      await sharp({
        create: {
          width: 50,
          height: 50,
          channels: 4,
          background: { r: 26, g: 26, b: 26, alpha: 1 }
        }
      })
      .composite([
        {
          input: Buffer.from(
            `<svg width="50" height="50" xmlns="http://www.w3.org/2000/svg">
              <rect width="50" height="50" fill="#1a1a1a"/>
              <text x="25" y="32" font-family="Arial" font-size="24" fill="white" text-anchor="middle">D</text>
            </svg>`
          ),
          top: 0,
          left: 0
        }
      ])
      .toFile(storeLogoPath);
      
      console.log(`Created custom ${storeLogoPath}`);
    } catch (error) {
      console.error('Error creating custom assets:', error);
      console.log('Falling back to standard assets...');
      
      // If custom assets fail, create standard ones from the icon
      const splashPath = path.join(assetsDir, 'SplashScreen.png');
      await sharp(sourceIcon)
        .resize(620, 300, { fit: 'contain', background: { r: 26, g: 26, b: 26, alpha: 1 } })
        .toFile(splashPath);
      
      const storeLogoPath = path.join(assetsDir, 'StoreLogo.png');
      await sharp(sourceIcon)
        .resize(50, 50)
        .toFile(storeLogoPath);
    }
    
    // Also copy the icon to the build directory as icon.ico if it doesn't exist
    const icoPath = path.join(buildDir, 'icon.ico');
    if (!fs.existsSync(icoPath)) {
      console.log('Creating a basic icon.ico file...');
      // For simplicity, just copy the PNG as ICO
      // In a real app, you'd use a proper ICO converter
      const iconPngPath = path.join(assetsDir, 'StoreLogo.png');
      fs.copyFileSync(iconPngPath, icoPath);
    }
    
    console.log('MSIX assets preparation complete!');
  } catch (error) {
    console.error('Error processing assets:', error);
    throw error;
  }
}

// Run the asset processing
processAssets().catch(err => {
  console.error('Asset processing failed:', err);
  process.exit(1);
});
