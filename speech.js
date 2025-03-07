const { ipcRenderer } = require('electron');
const axios = require('axios');
const { ElevenLabsClient } = require('elevenlabs');

class SpeechManager {
    constructor() {
        this.isListening = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.volume = 0.5; // Default volume
        this.audioElement = null;
        this.elevenLabsClient = null;
        this.voiceId = "JBFqnCBsd6RMkjVDRZzb"; // Default voice ID (George)
        this.modelId = "eleven_flash_v2_5"; // Using flash model
        this.serverUrl = 'http://localhost:3000'; // Local server URL
        
        // Initialize audio element if in browser environment
        if (typeof Audio !== 'undefined') {
            try {
                this.audioElement = new Audio();
                console.log('Audio element initialized');
            } catch (error) {
                console.warn('Failed to initialize Audio element:', error);
            }
        } else {
            console.warn('Audio API not available in this environment');
        }
        
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
                
                try {
                    // Pause and reset the old audio
                    oldAudio.pause();
                    oldAudio.currentTime = 0;
                } catch (error) {
                    console.warn('Error pausing audio:', error);
                }
                
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
                    // Create a new audio element each time if Audio is available
                    if (typeof Audio !== 'undefined') {
                        try {
                            this.audioElement = new Audio();
                            this.audioElement.volume = this.volume;
                        } catch (error) {
                            console.warn('Error creating Audio element:', error);
                            return resolve();
                        }
                    } else {
                        console.warn('Audio API not available, cannot play audio');
                        return resolve();
                    }
                
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
        try {
            if (volume === undefined || volume === null) {
                console.warn('Volume value is undefined or null, using default');
                volume = 0.5;
            }
            this.volume = Math.max(0, Math.min(1, parseFloat(volume) || 0.5));
            console.log(`Setting volume to ${this.volume}`);
            if (this.audioElement) {
                try {
                    this.audioElement.volume = this.volume;
                } catch (error) {
                    console.warn('Error setting audio element volume:', error);
                }
            }
        } catch (error) {
            console.error('Error setting volume:', error);
        }
    }
    
    /**
     * Set the voice for ElevenLabs TTS
     * @param {string} voiceId - ElevenLabs voice ID
     */
    setVoice(voiceId) {
        try {
            if (!voiceId) {
                console.warn('Voice ID is empty or undefined, keeping current voice');
                return;
            }
            
            // Validate voice ID format (basic check)
            if (typeof voiceId !== 'string' || voiceId.length < 5) {
                console.warn(`Invalid voice ID format: ${voiceId}, using default`);
                this.voiceId = "JBFqnCBsd6RMkjVDRZzb"; // Default to George
            } else {
                this.voiceId = voiceId;
                console.log(`Voice set to: ${voiceId}`);
            }
        } catch (error) {
            console.error('Error setting voice:', error);
            // Keep the previous voice ID in case of error
        }
    }

    /**
     * Check if speech recognition is supported
     * @returns {boolean} - True if supported, false otherwise
     */
    isSpeechRecognitionSupported() {
        try {
            // More comprehensive check for speech recognition support
            const hasMediaDevices = typeof navigator !== 'undefined' && 
                                   !!navigator.mediaDevices && 
                                   !!navigator.mediaDevices.getUserMedia;
            
            // Check for getUserMedia support
            const hasGetUserMedia = !!(navigator.getUserMedia || 
                                     navigator.webkitGetUserMedia || 
                                     navigator.mozGetUserMedia || 
                                     navigator.msGetUserMedia);
            
            const isSupported = hasMediaDevices || hasGetUserMedia;
            console.log(`Speech recognition supported: ${isSupported}`);
            console.log(`- Media devices API: ${hasMediaDevices}`);
            console.log(`- getUserMedia API: ${hasGetUserMedia}`);
            
            return isSupported;
        } catch (error) {
            console.error('Error checking speech recognition support:', error);
            return false;
        }
    }

    /**
     * Check if ElevenLabs TTS is available
     * @returns {boolean} - True if available, false otherwise
     */
    isElevenLabsAvailable() {
        try {
            // Check if the client exists and is properly initialized
            const clientExists = !!this.elevenLabsClient;
            
            // Additional check for required properties/methods on the client
            const clientHasVoices = clientExists && 
                                   !!this.elevenLabsClient.voices && 
                                   typeof this.elevenLabsClient.voices.getAll === 'function';
            
            const isAvailable = clientExists && clientHasVoices;
            
            console.log(`ElevenLabs available: ${isAvailable}`);
            console.log(`- Client exists: ${clientExists}`);
            console.log(`- Client has voices API: ${clientHasVoices}`);
            
            return isAvailable;
        } catch (error) {
            console.error('Error checking ElevenLabs availability:', error);
            return false;
        }
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
        console.log('Cleaning up SpeechManager resources');
        try {
            // Create a local reference to the audio element
            const audioEl = this.audioElement;
            
            if (audioEl && typeof audioEl === 'object') {
                console.log('Cleaning up audio element');
                
                // First remove event listeners to prevent any callbacks during cleanup
                try {
                    audioEl.oncanplaythrough = null;
                    audioEl.onloadedmetadata = null;
                    audioEl.onended = null;
                    audioEl.onerror = null;
                    audioEl.onpause = null;
                    audioEl.onplay = null;
                    console.log('Removed event listeners from audio element');
                } catch (listenerError) {
                    console.warn('Error removing event listeners:', listenerError);
                }
                
                // Then pause and reset
                try {
                    audioEl.pause();
                    audioEl.currentTime = 0;
                    console.log('Paused and reset audio element');
                } catch (pauseError) {
                    console.warn('Error pausing audio:', pauseError);
                }
                
                // Clear source if it exists
                if (audioEl.src && audioEl.src !== '') {
                    try {
                        // Check if it's an object URL
                        if (audioEl.src.startsWith('blob:')) {
                            URL.revokeObjectURL(audioEl.src);
                            console.log('Revoked object URL');
                        }
                    } catch (urlError) {
                        console.warn('Error revoking object URL:', urlError);
                    }
                    
                    try {
                        audioEl.src = '';
                        audioEl.load(); // Force the browser to apply the change
                        console.log('Cleared audio source');
                    } catch (srcError) {
                        console.warn('Error clearing audio source:', srcError);
                    }
                }
            } else {
                console.log('No audio element to clean up');
            }
            
            // Clean up any recording resources
            if (this.isListening && this.mediaRecorder) {
                try {
                    console.log('Stopping active listening session');
                    this.stopListening();
                } catch (e) {
                    console.warn('Error stopping listening during cleanup:', e);
                }
            }
            
            // Clean up any media streams
            if (this.mediaRecorder && this.mediaRecorder.stream) {
                try {
                    const tracks = this.mediaRecorder.stream.getTracks();
                    tracks.forEach(track => track.stop());
                    console.log(`Stopped ${tracks.length} media tracks`);
                } catch (trackError) {
                    console.warn('Error stopping media tracks:', trackError);
                }
            }
            
            console.log('Cleanup completed successfully');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
}

// Create a singleton instance with error handling
let instance;
try {
    console.log('Creating SpeechManager instance');
    
    // Check if we're in a browser environment
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
        console.log('Audio API is available');
        instance = new SpeechManager();
        console.log('SpeechManager instance created successfully');
    } else {
        console.warn('Audio API is not available in this environment, using fallback implementation');
        // Provide a minimal fallback implementation directly
        instance = {
            speak: () => Promise.resolve(),
            setVolume: () => {},
            setVoice: () => {},
            cleanup: () => {},
            isElevenLabsAvailable: () => false,
            isSpeechRecognitionSupported: () => false,
            startListening: () => {},
            stopListening: () => {},
            initElevenLabs: () => Promise.resolve(false)
        };
    }
} catch (error) {
    console.error('Error creating SpeechManager instance:', error);
    console.error('Stack trace:', error.stack);
    // Provide a minimal fallback implementation
    console.warn('Using fallback implementation for SpeechManager due to error');
    instance = {
        speak: () => Promise.resolve(),
        setVolume: () => {},
        setVoice: () => {},
        cleanup: () => {},
        isElevenLabsAvailable: () => false,
        isSpeechRecognitionSupported: () => false,
        startListening: () => {},
        stopListening: () => {},
        initElevenLabs: () => Promise.resolve(false)
    };
}

module.exports = instance;
