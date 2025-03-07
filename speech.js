const { ipcRenderer } = require('electron');

class SpeechManager {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.volume = 0.5; // Default volume
        this.isListening = false;
        this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        
        // Initialize speech recognition if supported
        if (this.isSupported) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
        } else {
            console.warn('Speech recognition is not supported in this browser');
        }
    }

    /**
     * Start listening for speech input
     * @param {Function} onResult - Callback function for speech results
     * @param {Function} onEnd - Callback function for when listening ends
     */
    startListening(onResult, onEnd) {
        if (!this.isSupported || this.isListening) return;
        
        this.isListening = true;
        
        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log('Speech recognized:', transcript);
            if (onResult) onResult(transcript);
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            if (onEnd) onEnd(event.error);
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            if (onEnd) onEnd();
        };
        
        this.recognition.start();
        console.log('Speech recognition started');
    }

    /**
     * Stop listening for speech input
     */
    stopListening() {
        if (!this.isSupported || !this.isListening) return;
        
        this.recognition.stop();
        this.isListening = false;
        console.log('Speech recognition stopped');
    }

    /**
     * Speak text using speech synthesis
     * @param {string} text - Text to speak
     * @returns {Promise} - Resolves when speech is complete
     */
    speak(text) {
        return new Promise((resolve) => {
            if (!this.synthesis) {
                console.warn('Speech synthesis is not supported');
                resolve();
                return;
            }
            
            // Cancel any ongoing speech
            this.synthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.volume = this.volume;
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            
            utterance.onend = () => {
                resolve();
            };
            
            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
                resolve();
            };
            
            this.synthesis.speak(utterance);
        });
    }

    /**
     * Set the volume for speech synthesis
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Check if speech recognition is supported
     * @returns {boolean} - True if supported, false otherwise
     */
    isSpeechRecognitionSupported() {
        return this.isSupported;
    }

    /**
     * Check if speech synthesis is supported
     * @returns {boolean} - True if supported, false otherwise
     */
    isSpeechSynthesisSupported() {
        return !!this.synthesis;
    }
}

module.exports = new SpeechManager();
