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
        
        if (!this.elevenLabsClient) {
            console.warn('ElevenLabs client not initialized, attempting to initialize now...');
            await this.initElevenLabs();
            
            // Check again after initialization attempt
            if (!this.elevenLabsClient) {
                console.warn('ElevenLabs client still not initialized, falling back to browser TTS');
                return this.fallbackSpeak(text);
            }
        }
        
        try {
            console.log('Converting text to speech with ElevenLabs:', text);
            console.log('Using voice ID:', this.voiceId);
            console.log('Using model ID:', this.modelId);
            
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
            // Fall back to browser's built-in TTS
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
            if (!window.speechSynthesis) {
                console.warn('Speech synthesis is not supported');
                resolve();
                return;
            }
            
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            
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
            
            window.speechSynthesis.speak(utterance);
        });
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
