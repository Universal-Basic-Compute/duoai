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
        this.voiceId = "JBFqnCBsd6RMkjVDRZzb"; // Default voice ID (George)
        this.modelId = "eleven_flash_v2_5"; // Using flash model
        this.serverUrl = 'http://localhost:3000'; // Local server URL
        
        // Initialize ElevenLabs client if API key is available
        this.initElevenLabs();
    }
    
    /**
     * Initialize ElevenLabs client
     * @returns {Promise<boolean>} - True if initialization was successful
     */
    async initElevenLabs() {
        try {
            console.log(`Checking for ElevenLabs API key at ${this.serverUrl}/api/elevenlabs/key`);
            
            // Get API key from server
            const response = await axios.get(`${this.serverUrl}/api/elevenlabs/key`, {
                timeout: 5000 // 5 second timeout
            });
            
            console.log('ElevenLabs key response:', response.data ? 'Received' : 'Empty');
            
            if (response.data && response.data.key) {
                console.log('Initializing ElevenLabs client with key:', response.data.maskedKey);
                
                try {
                    this.elevenLabsClient = new ElevenLabsClient({
                        apiKey: response.data.key
                    });
                    
                    console.log('ElevenLabs client initialized successfully');
                    
                    // Try to verify the client works by getting voices
                    try {
                        const voices = await this.elevenLabsClient.voices.getAll();
                        console.log('Successfully retrieved voices from ElevenLabs:', 
                                   voices && voices.length ? `${voices.length} voices found` : 'No voices found');
                        
                        // Set default model
                        this.modelId = "eleven_flash_v2_5"; // Using flash model
                        
                        // Get available voices
                        this.loadVoices();
                        return true;
                    } catch (voicesError) {
                        console.error('Error verifying ElevenLabs client with voices call:', voicesError);
                        // Client initialized but voices call failed - still return true
                        // as the client might work for TTS
                        this.modelId = "eleven_monolingual_v1"; // Use more stable model
                        return true;
                    }
                } catch (clientError) {
                    console.error('Error creating ElevenLabs client:', clientError);
                    return false;
                }
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
                    
                    // Send to Whisper API on remote server
                    const response = await axios.post(`${this.serverUrl}/api/whisper`, {
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
        try {
            // Stop any currently playing audio and ensure it's properly disposed
            if (this.audioElement) {
                // Create a reference to the old audio element
                const oldAudio = this.audioElement;
                
                // Pause and reset the old audio
                oldAudio.pause();
                oldAudio.currentTime = 0;
                
                // Remove any event listeners to prevent memory leaks
                oldAudio.oncanplaythrough = null;
                oldAudio.onloadedmetadata = null;
                oldAudio.onended = null;
                oldAudio.onerror = null;
                
                // Clear the source
                if (oldAudio.src) {
                    URL.revokeObjectURL(oldAudio.src);
                    oldAudio.src = '';
                    oldAudio.load(); // Force the browser to apply the change
                }
            }
            
            // For very short text, just skip it
            if (!text || text.length < 10) {
                console.log('Text is very short or empty, skipping TTS');
                return Promise.resolve();
            }
        
        if (!this.elevenLabsClient) {
            console.warn('ElevenLabs client not initialized, attempting to initialize now...');
            const initialized = await this.initElevenLabs();
            
            // Check again after initialization attempt
            if (!initialized) {
                console.warn('ElevenLabs client not initialized, cannot speak text');
                return Promise.resolve();
            }
        }
        
        try {
            console.log('Converting text to speech with ElevenLabs:', text.substring(0, 50) + '...');
            console.log('Using voice ID:', this.voiceId);
            console.log('Using model ID:', this.modelId);
            
            // Always use the flash model
            const useModel = "eleven_flash_v2_5";
            console.log(`Using model for this request: ${useModel}`);
            
            console.log(`Sending TTS request to ${this.serverUrl}/api/elevenlabs/tts`);
            
            // Use the server as a proxy to avoid exposing API key in client
            try {
                console.log(`Sending TTS request to server with voice ID: ${this.voiceId}`);
                const response = await axios.post(`${this.serverUrl}/api/elevenlabs/tts`, {
                    text: text,
                    voiceId: this.voiceId,
                    modelId: useModel
                }, {
                    responseType: 'arraybuffer',
                    timeout: 60000 // 60 second timeout for longer texts
                });
                    
                // Log the response size properly
                const responseSize = response.data ? (response.data.byteLength || response.data.length || 0) : 0;
                console.log('Received TTS response, size:', responseSize);
                
                // Check if we received valid audio data
                if (!response.data || responseSize < 1000) {
                    console.error('Received invalid or empty audio data (size:', responseSize, 'bytes)');
                
                    // Try to decode the response as JSON error
                    if (response.data && responseSize > 0) {
                        try {
                            // Convert ArrayBuffer to string
                            const decoder = new TextDecoder('utf-8');
                            const errorText = decoder.decode(response.data);
                            console.error('Error response content:', errorText);
                        
                            // Try to parse as JSON
                            try {
                                const errorJson = JSON.parse(errorText);
                                console.error('Parsed error JSON:', errorJson);
                            } catch (jsonError) {
                                console.error('Error response is not valid JSON');
                            }
                        } catch (decodeError) {
                            console.error('Could not decode error response as text:', decodeError);
                        }
                    }
                
                    return Promise.resolve();
                }
                
                // Create blob from array buffer with explicit MIME type
                const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
                console.log('Created audio blob, size:', audioBlob.size);
                
                const audioUrl = URL.createObjectURL(audioBlob);
                console.log('Created audio URL:', audioUrl);
                
                // Play the audio with better error handling
                return new Promise((resolve) => {
                    // Create a new audio element each time
                    this.audioElement = new Audio();
                    this.audioElement.volume = this.volume;
                
                    // Log audio element creation
                    console.log('Created new Audio element for playback');
                
                    // Set the source before attaching event handlers
                    this.audioElement.src = audioUrl;
                    
                    this.audioElement.oncanplaythrough = () => {
                        console.log('Audio can play through, starting playback');
                        this.audioElement.play().catch(error => {
                            console.error('Error playing audio:', error);
                            URL.revokeObjectURL(audioUrl);
                            resolve();
                        });
                    };
                    
                    // Add loadedmetadata event to log audio duration
                    this.audioElement.onloadedmetadata = () => {
                        console.log('Audio metadata loaded, duration:', 
                               this.audioElement.duration, 
                               'seconds, volume:', this.volume);
                    };
                    
                    this.audioElement.onended = () => {
                        console.log('Audio playback ended');
                        URL.revokeObjectURL(audioUrl);
                        resolve();
                    };
                    
                    this.audioElement.onerror = (error) => {
                        console.error('Error loading audio:', error);
                        URL.revokeObjectURL(audioUrl);
                        resolve();
                    };
                    
                    // Set a timeout in case the audio never loads
                    setTimeout(() => {
                        if (this.audioElement.readyState < 3) { // HAVE_FUTURE_DATA
                            console.warn('Audio taking too long to load');
                            URL.revokeObjectURL(audioUrl);
                            resolve();
                        }
                    }, 5000); // 5 second timeout
                });
            } catch (apiError) {
                console.error('Error with ElevenLabs API call:', apiError.message);
            
                // Try to extract error details from the response
                if (apiError.response && apiError.response.data) {
                    try {
                        // If the response is an ArrayBuffer, try to decode it
                        if (apiError.response.data instanceof ArrayBuffer) {
                            const decoder = new TextDecoder('utf-8');
                            const errorText = decoder.decode(apiError.response.data);
                            console.error('Error response content:', errorText);
                        
                            // Try to parse as JSON
                            try {
                                const errorJson = JSON.parse(errorText);
                                console.error('Parsed error JSON:', errorJson);
                            } catch (jsonError) {
                                console.error('Error response is not valid JSON');
                            }
                        } else {
                            console.error('Error response data:', apiError.response.data);
                        }
                    } catch (decodeError) {
                        console.error('Could not decode error response:', decodeError);
                    }
                }
            
                return Promise.resolve();
            }
        } catch (error) {
            console.error('Error with ElevenLabs TTS:', error);
            console.error('Error details:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data type:', typeof error.response.data);
                console.error('Response headers:', JSON.stringify(error.response.headers));
            }
            
            return Promise.resolve();
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
    
    /**
     * Clean up resources
     */
    cleanup() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            
            if (this.audioElement.src) {
                URL.revokeObjectURL(this.audioElement.src);
                this.audioElement.src = '';
            }
            
            // Remove event listeners
            this.audioElement.oncanplaythrough = null;
            this.audioElement.onloadedmetadata = null;
            this.audioElement.onended = null;
            this.audioElement.onerror = null;
        }
    }
}

module.exports = new SpeechManager();
