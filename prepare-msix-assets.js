const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Define the assets directory
const assetsDir = path.join(__dirname, 'assets');
const svgDir = path.join(__dirname, 'svg');
const buildDir = path.join(__dirname, 'build');

// Create the directories if they don't exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}
if (!fs.existsSync(svgDir)) {
  fs.mkdirSync(svgDir, { recursive: true });
}
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Define the required assets with their SVG source files
const requiredAssets = [
  { name: 'Square44x44Logo.png', svgName: 'Square44x44Logo.svg' },
  { name: 'Square150x150Logo.png', svgName: 'Square150x150Logo.svg' },
  { name: 'Wide310x150Logo.png', svgName: 'Wide310x150Logo.svg' },
  { name: 'LargeTile.png', svgName: 'LargeTile.svg' },
  { name: 'SmallTile.png', svgName: 'SmallTile.svg' },
  { name: 'StoreLogo.png', svgName: 'StoreLogo.svg' },
  { name: 'SplashScreen.png', svgName: 'SplashScreen.svg' },
  { name: 'BadgeLogo.png', svgName: 'BadgeLogo.svg' }
];

// Function to convert SVG to PNG
async function convertSvgToPng(svgPath, pngPath) {
  try {
    await sharp(svgPath)
      .png()
      .toFile(pngPath);
    console.log(`Created ${pngPath} from SVG`);
  } catch (error) {
    console.error(`Error creating ${pngPath} from SVG:`, error);
    throw error;
  }
}

// Process each required asset
async function processAssets() {
  console.log('Preparing MSIX assets from SVG files...');
  
  try {
    // Process all the standard assets
    for (const asset of requiredAssets) {
      const svgPath = path.join(svgDir, asset.svgName);
      const targetPath = path.join(assetsDir, asset.name);
      
      if (fs.existsSync(svgPath)) {
        await convertSvgToPng(svgPath, targetPath);
      } else {
        console.error(`SVG file not found: ${svgPath}`);
      }
    }
    
    // Also create icon.png in the build directory
    const iconSvgPath = path.join(svgDir, 'Icon.svg');
    const iconPngPath = path.join(buildDir, 'icon.png');
    
    if (fs.existsSync(iconSvgPath)) {
      await convertSvgToPng(iconSvgPath, iconPngPath);
      
      // Also create icon.ico from the PNG
      console.log('Creating icon.ico from icon.png...');
      const icoPath = path.join(buildDir, 'icon.ico');
      
      // For simplicity, we'll just copy the PNG as ICO
      // In a real app, you'd use a proper ICO converter
      fs.copyFileSync(iconPngPath, icoPath);
      console.log(`Created ${icoPath}`);
    } else {
      console.error('Icon SVG file not found:', iconSvgPath);
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
