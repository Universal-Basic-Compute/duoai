const { ipcRenderer } = require('electron');
const axios = require('axios');
const { ElevenLabsClient } = require('elevenlabs');

class SpeechManager {
    constructor() {
        this.isListening = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.volume = 0.5; // Default volume
        this.audioElement = new Audio();
        this.elevenLabsClient = null;
        this.voiceId = "JBFqnCBsd6RMkjVDRZzb"; // Default voice ID (Rachel)
        this.modelId = "eleven_flash_v2_5"; // Default model
        
        // Initialize ElevenLabs client if API key is available
        this.initElevenLabs();
    }
    
    /**
     * Initialize ElevenLabs client
     * @returns {Promise<boolean>} - True if initialization was successful
     */
    async initElevenLabs() {
        try {
            // Get the server port from localStorage or default to 3000
            const serverPort = localStorage.getItem('serverPort') || 3000;
            
            console.log(`Checking for ElevenLabs API key at http://localhost:${serverPort}/api/elevenlabs/key`);
            
            // Get API key from server
            const response = await axios.get(`http://localhost:${serverPort}/api/elevenlabs/key`, {
                timeout: 5000 // 5 second timeout
            });
            
            console.log('ElevenLabs key response:', response.data ? 'Received' : 'Empty');
            
            if (response.data && response.data.key) {
                console.log('Initializing ElevenLabs client with key:', response.data.maskedKey);
                
                this.elevenLabsClient = new ElevenLabsClient({
                    apiKey: response.data.key
                });
                
                console.log('ElevenLabs client initialized successfully');
                
                // Get available voices
                this.loadVoices();
                return true;
            } else {
                console.error('No ElevenLabs API key received from server');
                return false;
            }
        } catch (error) {
            console.error('Error initializing ElevenLabs client:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
            }
            return false;
        }
    }
    
    /**
     * Load available voices from ElevenLabs
     */
    async loadVoices() {
        if (!this.elevenLabsClient) return;
        
        try {
            const voices = await this.elevenLabsClient.voices.getAll();
            console.log('Available voices:', voices);
        } catch (error) {
            console.error('Error loading voices:', error);
        }
    }

    /**
     * Start listening for speech input
     * @param {Function} onResult - Callback function for speech results
     * @param {Function} onEnd - Callback function for when listening ends
     */
    async startListening(onResult, onEnd) {
        if (this.isListening) return;
        
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            this.isListening = true;
            this.audioChunks = [];
            
            // Create media recorder
            this.mediaRecorder = new MediaRecorder(stream);
            
            // Handle data available event
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            // Handle recording stop event
            this.mediaRecorder.onstop = async () => {
                // Create audio blob
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                
                try {
                    // Convert blob to base64
                    const base64Audio = await this.blobToBase64(audioBlob);
                    
                    // Get the server port from localStorage or default to 3000
                    const serverPort = localStorage.getItem('serverPort') || 3000;
                    
                    // Send to Whisper API
                    const response = await axios.post(`http://localhost:${serverPort}/api/whisper`, {
                        audioData: base64Audio
                    });
                    
                    const transcript = response.data.transcription;
                    console.log('Whisper transcription:', transcript);
                    
                    if (onResult) onResult(transcript);
                } catch (error) {
                    console.error('Error transcribing audio:', error);
                    if (onEnd) onEnd(error.message);
                }
                
                // Stop all tracks in the stream
                stream.getTracks().forEach(track => track.stop());
                
                this.isListening = false;
                if (onEnd) onEnd();
            };
            
            // Start recording
            this.mediaRecorder.start();
            console.log('Speech recording started');
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            this.isListening = false;
            if (onEnd) onEnd(error.message);
        }
    }

    /**
     * Stop listening for speech input
     */
    stopListening() {
        if (!this.isListening || !this.mediaRecorder) return;
        
        this.mediaRecorder.stop();
        console.log('Speech recording stopped');
    }

    /**
     * Convert Blob to base64
     * @param {Blob} blob - Audio blob
     * @returns {Promise<string>} - Base64 string
     */
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Speak text using ElevenLabs
     * @param {string} text - Text to speak
     * @returns {Promise} - Resolves when speech is complete
     */
    async speak(text) {
        // Stop any currently playing audio
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        
        // Check if text is empty or too short
        if (!text || text.length < 2) {
            console.warn('Text too short for TTS, skipping');
            return Promise.resolve();
        }
        
        // Try ElevenLabs first, but be ready to fall back
        let useElevenLabs = !!this.elevenLabsClient;
        
        if (useElevenLabs) {
            try {
                console.log('Converting text to speech with ElevenLabs:', text);
                
                // Get the server port from localStorage or default to 3000
                const serverPort = localStorage.getItem('serverPort') || 3000;
                
                console.log(`Sending TTS request to http://localhost:${serverPort}/api/elevenlabs/tts`);
                
                // Use the server as a proxy to avoid exposing API key in client
                const response = await axios.post(`http://localhost:${serverPort}/api/elevenlabs/tts`, {
                    text: text,
                    voiceId: this.voiceId,
                    modelId: this.modelId
                }, {
                    responseType: 'arraybuffer',
                    timeout: 30000 // 30 second timeout
                });
                
                // Check if we got a valid response
                if (response.status !== 200 || !response.data || response.data.byteLength < 1000) {
                    console.warn('Received unusually small audio file, might be an error response');
                    throw new Error('Invalid audio response');
                }
                
                console.log('Received TTS response, size:', response.data.byteLength);
                
                // Create blob from array buffer
                const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                console.log('Created audio URL:', audioUrl);
                
                // Play the audio
                return new Promise((resolve) => {
                    this.audioElement.src = audioUrl;
                    this.audioElement.volume = this.volume;
                    
                    this.audioElement.onended = () => {
                        console.log('Audio playback ended');
                        URL.revokeObjectURL(audioUrl);
                        resolve();
                    };
                    
                    this.audioElement.onerror = (error) => {
                        console.error('Error playing audio:', error);
                        URL.revokeObjectURL(audioUrl);
                        resolve();
                    };
                    
                    console.log('Starting audio playback');
                    this.audioElement.play().catch(error => {
                        console.error('Error playing audio:', error);
                        resolve();
                    });
                });
            } catch (error) {
                console.error('Error with ElevenLabs TTS:', error);
                console.error('Error details:', error.message);
                if (error.response) {
                    console.error('Response status:', error.response.status);
                    console.error('Response headers:', error.response.headers);
                }
                
                // Mark ElevenLabs as unavailable for this session to avoid repeated failures
                console.warn('Disabling ElevenLabs for this session due to errors');
                this.elevenLabsClient = null;
                
                // Fall back to browser's built-in TTS
                return this.fallbackSpeak(text);
            }
        } else {
            // Use browser's built-in TTS
            return this.fallbackSpeak(text);
        }
    }
    
    /**
     * Fallback to browser's built-in speech synthesis
     * @param {string} text - Text to speak
     * @returns {Promise} - Resolves when speech is complete
     */
    fallbackSpeak(text) {
        return new Promise((resolve) => {
            console.log('Using browser speech synthesis fallback');
            
            if (!window.speechSynthesis) {
                console.warn('Speech synthesis is not supported in this browser');
                resolve();
                return;
            }
            
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Try to find a good voice
            let voices = window.speechSynthesis.getVoices();
            if (voices.length === 0) {
                // Sometimes voices aren't loaded immediately
                setTimeout(() => {
                    voices = window.speechSynthesis.getVoices();
                    this.setFallbackVoice(utterance, voices);
                }, 200);
            } else {
                this.setFallbackVoice(utterance, voices);
            }
            
            utterance.volume = this.volume;
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            
            utterance.onend = () => {
                console.log('Browser speech synthesis completed');
                resolve();
            };
            
            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
                resolve();
            };
            
            window.speechSynthesis.speak(utterance);
        });
    }
    
    /**
     * Set the best available voice for fallback speech synthesis
     * @param {SpeechSynthesisUtterance} utterance - The utterance to set voice for
     * @param {SpeechSynthesisVoice[]} voices - Available voices
     */
    setFallbackVoice(utterance, voices) {
        // Try to find a good English voice
        const preferredVoices = [
            // Look for these voice names in order of preference
            { name: 'Google UK English Female', lang: 'en-GB' },
            { name: 'Microsoft Zira', lang: 'en-US' },
            { name: 'Samantha', lang: 'en-US' },
            { name: 'Google US English', lang: 'en-US' }
        ];
        
        // Try to find one of our preferred voices
        for (const preferred of preferredVoices) {
            const voice = voices.find(v => 
                v.name === preferred.name || 
                (v.name.includes(preferred.name) && v.lang.includes(preferred.lang))
            );
            if (voice) {
                utterance.voice = voice;
                console.log('Using fallback voice:', voice.name);
                return;
            }
        }
        
        // If no preferred voice found, try to find any English voice
        const englishVoice = voices.find(v => v.lang.startsWith('en-'));
        if (englishVoice) {
            utterance.voice = englishVoice;
            console.log('Using English fallback voice:', englishVoice.name);
            return;
        }
        
        // If still no voice, use the first available voice
        if (voices.length > 0) {
            utterance.voice = voices[0];
            console.log('Using first available fallback voice:', voices[0].name);
        }
    }

    /**
     * Set the volume for speech
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.audioElement.volume = this.volume;
    }
    
    /**
     * Set the voice for ElevenLabs TTS
     * @param {string} voiceId - ElevenLabs voice ID
     */
    setVoice(voiceId) {
        this.voiceId = voiceId;
    }

    /**
     * Check if speech recognition is supported
     * @returns {boolean} - True if supported, false otherwise
     */
    isSpeechRecognitionSupported() {
        return !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;
    }

    /**
     * Check if ElevenLabs TTS is available
     * @returns {boolean} - True if available, false otherwise
     */
    isElevenLabsAvailable() {
        return !!this.elevenLabsClient;
    }
}

module.exports = new SpeechManager();
