const fs = require('fs');
const path = require('path');

// Ensure the build directory exists
const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Create a resources directory if it doesn't exist
const resourcesDir = path.join(buildDir, 'resources');
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

// Copy critical files to the resources directory
const filesToCopy = [
  'index.html',
  'styles.css'
];

filesToCopy.forEach(file => {
  const sourcePath = path.join(__dirname, file);
  const destPath = path.join(resourcesDir, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied ${file} to resources directory`);
  } else {
    console.warn(`Warning: ${file} not found in source directory`);
  }
});

// Copy prompts directory
const promptsSourceDir = path.join(__dirname, 'prompts');
const promptsDestDir = path.join(resourcesDir, 'prompts');

if (fs.existsSync(promptsSourceDir)) {
  // Create prompts directory in resources
  if (!fs.existsSync(promptsDestDir)) {
    fs.mkdirSync(promptsDestDir, { recursive: true });
  }
  
  // Create characters directory in resources/prompts
  const charactersDestDir = path.join(promptsDestDir, 'characters');
  if (!fs.existsSync(charactersDestDir)) {
    fs.mkdirSync(charactersDestDir, { recursive: true });
  }
  
  // Copy base prompt
  const basePromptSource = path.join(promptsSourceDir, 'base_prompt.txt');
  const basePromptDest = path.join(promptsDestDir, 'base_prompt.txt');
  
  if (fs.existsSync(basePromptSource)) {
    fs.copyFileSync(basePromptSource, basePromptDest);
    console.log('Copied base_prompt.txt to resources/prompts');
  }
  
  // Copy character prompts
  const charactersSourceDir = path.join(promptsSourceDir, 'characters');
  if (fs.existsSync(charactersSourceDir)) {
    const characterFiles = fs.readdirSync(charactersSourceDir);
    
    characterFiles.forEach(file => {
      const sourcePath = path.join(charactersSourceDir, file);
      const destPath = path.join(charactersDestDir, file);
      
      if (fs.statSync(sourcePath).isFile()) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`Copied ${file} to resources/prompts/characters`);
      }
    });
  }
}

console.log('Build preparation complete!');
