const fs = require('fs');
const path = require('path');

class SystemPromptBuilder {
    constructor() {
        // Use __dirname for local development and process.cwd() for Vercel
        this.rootDir = process.env.VERCEL ? process.cwd() : __dirname;
        this.basePromptPath = path.join(this.rootDir, 'prompts', 'base_prompt.txt');
        this.charactersPath = path.join(this.rootDir, 'prompts', 'characters');
        
        // Ensure directories exist
        this.ensureDirectoriesExist();
    }

    /**
     * Ensure that the prompts directories exist
     */
    ensureDirectoriesExist() {
        try {
            // Create prompts directory if it doesn't exist
            if (!fs.existsSync(path.join(this.rootDir, 'prompts'))) {
                fs.mkdirSync(path.join(this.rootDir, 'prompts'), { recursive: true });
                console.log('Created prompts directory');
            }
            
            // Create characters directory if it doesn't exist
            if (!fs.existsSync(this.charactersPath)) {
                fs.mkdirSync(this.charactersPath, { recursive: true });
                console.log('Created characters directory');
            }
            
            // Create base prompt file with default content if it doesn't exist
            if (!fs.existsSync(this.basePromptPath)) {
                const defaultBasePrompt = "You are DuoAI, an advanced gaming assistant with access to the player's screen.";
                fs.writeFileSync(this.basePromptPath, defaultBasePrompt);
                console.log('Created default base prompt file');
            }
        } catch (error) {
            console.error('Error ensuring directories exist:', error);
        }
    }

    /**
     * Read the content of a file
     * @param {string} filePath - Path to the file
     * @returns {string} - Content of the file
     */
    readPromptFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                console.warn(`Prompt file not found: ${filePath}`);
                return '';
            }
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            console.error(`Error reading prompt file ${filePath}:`, error);
            return '';
        }
    }

    /**
     * Get the base system prompt
     * @returns {string} - Base system prompt
     */
    getBasePrompt() {
        const basePrompt = this.readPromptFile(this.basePromptPath);
        if (!basePrompt) {
            console.warn('Base prompt not found or empty, using default');
            return "You are DuoAI, an advanced gaming assistant with access to the player's screen.";
        }
        return basePrompt;
    }

    /**
     * Get a character-specific prompt
     * @param {string} characterName - Name of the character (lowercase)
     * @returns {string} - Character-specific prompt or empty string if not found
     */
    getCharacterPrompt(characterName) {
        if (!characterName) {
            console.warn('No character name provided');
            return '';
        }
        
        const characterFile = path.join(this.charactersPath, `${characterName.toLowerCase()}.txt`);
        return this.readPromptFile(characterFile);
    }

    /**
     * Build a complete system prompt by combining the base prompt with a character-specific prompt
     * @param {string} characterName - Name of the character
     * @returns {string} - Combined system prompt
     */
    buildSystemPrompt(characterName) {
        const basePrompt = this.getBasePrompt();
        
        if (!characterName) {
            console.log('No character name provided, using base prompt only');
            return basePrompt;
        }
        
        const characterPrompt = this.getCharacterPrompt(characterName);
        
        if (!characterPrompt) {
            console.warn(`Character prompt for "${characterName}" not found. Using base prompt only.`);
            return basePrompt;
        }
        
        // Combine the prompts with a separator
        console.log(`Built system prompt for character: ${characterName}`);
        return `${basePrompt}\n\n${'='.repeat(50)}\n\n${characterPrompt}`;
    }

    /**
     * Get a list of available character names
     * @returns {string[]} - Array of character names (without file extensions)
     */
    getAvailableCharacters() {
        try {
            if (!fs.existsSync(this.charactersPath)) {
                console.warn('Characters directory does not exist');
                return [];
            }
            
            const files = fs.readdirSync(this.charactersPath);
            const characters = files
                .filter(file => file.endsWith('.txt'))
                .map(file => path.basename(file, '.txt'));
                
            console.log(`Found ${characters.length} available characters`);
            return characters;
        } catch (error) {
            console.error('Error reading characters directory:', error);
            return [];
        }
    }
}

module.exports = new SystemPromptBuilder();
