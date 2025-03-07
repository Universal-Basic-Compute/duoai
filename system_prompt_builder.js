const fs = require('fs');
const path = require('path');

class SystemPromptBuilder {
    constructor() {
        // Use __dirname for local development and process.cwd() for Vercel
        const rootDir = process.env.VERCEL ? process.cwd() : __dirname;
        this.basePromptPath = path.join(rootDir, 'prompts', 'base_prompt.txt');
        this.charactersPath = path.join(rootDir, 'prompts', 'characters');
    }

    /**
     * Read the content of a file
     * @param {string} filePath - Path to the file
     * @returns {string} - Content of the file
     */
    readPromptFile(filePath) {
        try {
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
        return this.readPromptFile(this.basePromptPath);
    }

    /**
     * Get a character-specific prompt
     * @param {string} characterName - Name of the character (lowercase)
     * @returns {string} - Character-specific prompt or empty string if not found
     */
    getCharacterPrompt(characterName) {
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
        const characterPrompt = this.getCharacterPrompt(characterName);
        
        if (!characterPrompt) {
            console.warn(`Character prompt for "${characterName}" not found. Using base prompt only.`);
            return basePrompt;
        }
        
        // Combine the prompts with a separator
        return `${basePrompt}\n\n${'='.repeat(50)}\n\n${characterPrompt}`;
    }

    /**
     * Get a list of available character names
     * @returns {string[]} - Array of character names (without file extensions)
     */
    getAvailableCharacters() {
        try {
            const files = fs.readdirSync(this.charactersPath);
            return files
                .filter(file => file.endsWith('.txt'))
                .map(file => path.basename(file, '.txt'));
        } catch (error) {
            console.error('Error reading characters directory:', error);
            return [];
        }
    }
}

module.exports = new SystemPromptBuilder();
