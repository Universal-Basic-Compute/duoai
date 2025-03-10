// Try to import dependencies safely
let ipcRenderer;
let axios;
let ElevenLabsClient;

// Safely import Electron
try {
    const electron = require('electron');
    ipcRenderer = electron.ipcRenderer;
} catch (error) {
    console.warn('Electron not available:', error.message);
    ipcRenderer = null;
}

// Safely import axios
try {
    axios = require('axios');
} catch (error) {
    console.warn('axios not available:', error.message);
    // Create a minimal axios fallback
    axios = {
        get: () => Promise.reject(new Error('axios not available')),
        post: () => Promise.reject(new Error('axios not available'))
    };
}

// Safely import ElevenLabs
try {
    const elevenlabs = require('elevenlabs');
    ElevenLabsClient = elevenlabs.ElevenLabsClient;
} catch (error) {
    console.warn('ElevenLabs not available:', error.message);
    // Create a minimal ElevenLabsClient fallback
    ElevenLabsClient = class {
        constructor() {
            this.voices = { getAll: () => Promise.reject(new Error('ElevenLabs not available')) };
        }
    };
}

// Load config to get API URL
const { loadConfig } = require('./config');

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
        this.isContinuousListening = true; // Default to continuous listening
        this.silenceTimeout = null;
        this.silenceThreshold = 2000; // 2 seconds of silence before auto-sending
        this.hasSpeech = false; // Flag to track if speech has been detected
        this.speechCallback = null; // Store the callback for speech results
        this.endCallback = null; // Store the callback for when listening ends
        this.audioContext = null;
        this.analyser = null;
        this.microphoneStream = null;
        this.silenceDetectionRunning = false;
        this.isPlayingAudio = false; // Flag to track when audio is playing
        
        // Always use production URL
        this.serverUrl = 'https://duoai.vercel.app';
        
        // Safely detect environment with try-catch for each check
        try {
            this.isBrowserEnv = typeof window !== 'undefined';
        } catch (e) {
            console.warn('Error detecting browser environment:', e.message);
            this.isBrowserEnv = false;
        }
        
        try {
            this.hasAudioAPI = typeof Audio !== 'undefined';
        } catch (e) {
            console.warn('Error detecting Audio API:', e.message);
            this.hasAudioAPI = false;
        }
        
        try {
            this.isNodeEnv = typeof process !== 'undefined' && 
                            process.versions && 
                            process.versions.node;
        } catch (e) {
            console.warn('Error detecting Node.js environment:', e.message);
            this.isNodeEnv = false;
        }
        
        try {
            this.isElectronEnv = typeof process !== 'undefined' && 
                                process.versions && 
                                process.versions.electron;
        } catch (e) {
            console.warn('Error detecting Electron environment:', e.message);
            this.isElectronEnv = false;
        }
        
        console.log(`SpeechManager environment: Browser: ${this.isBrowserEnv}, Audio API: ${this.hasAudioAPI}, Node: ${this.isNodeEnv}, Electron: ${this.isElectronEnv}`);
        
        // Initialize audio element if in browser environment
        if (this.hasAudioAPI) {
            try {
                this.audioElement = new Audio();
                console.log('Audio element initialized');
            } catch (error) {
                console.warn('Failed to initialize Audio element:', error);
                this.hasAudioAPI = false; // Update flag since Audio failed
            }
        } else {
            console.warn('Audio API not available in this environment');
        }
        
        // Initialize ElevenLabs client if API key is available
        this.initElevenLabs().catch(err => {
            console.warn('Failed to initialize ElevenLabs during construction:', err.message);
        });
    }
    
    /**
     * Initialize ElevenLabs client
     * @returns {Promise<boolean>} - True if initialization was successful
     */
    async initElevenLabs() {
        // Skip if we're not in an environment with network capabilities
        if (!this.isBrowserEnv && !this.isNodeEnv && !this.isElectronEnv) {
            console.log('No network capabilities detected, skipping ElevenLabs initialization');
            return false;
        }
        
        try {
            // Check if axios is available
            if (!axios || typeof axios.get !== 'function') {
                console.error('axios is not available, cannot initialize ElevenLabs');
                return false;
            }
            
            // Check if ElevenLabsClient is available
            if (!ElevenLabsClient) {
                console.error('ElevenLabsClient is not available, cannot initialize ElevenLabs');
                return false;
            }
            
            // Always use production URL
            const apiUrl = 'https://duoai.vercel.app';
            console.log(`Checking for ElevenLabs API key at ${apiUrl}/api/elevenlabs/key`);
            
            // Get API key from server with better error handling
            let response;
            try {
                response = await axios.get(`${apiUrl}/api/elevenlabs/key`, {
                    timeout: 5000 // 5 second timeout
                });
            } catch (axiosError) {
                console.error('Error fetching ElevenLabs API key:', axiosError.message);
                if (axiosError.response) {
                    console.error('Response status:', axiosError.response.status);
                }
                return false;
            }
            
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
                        this.loadVoices().catch(e => console.warn('Error loading voices:', e.message));
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
                    
                    // Always use production URL
                    const apiUrl = 'https://duoai.vercel.app';
                
                    // Send to Whisper API on remote server with production URL
                    const response = await axios.post(`${apiUrl}/api/whisper`, {
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
     * Start continuous listening for speech input with auto-send
     * @param {Function} onResult - Callback function for speech results
     * @param {Function} onEnd - Callback function for when listening ends
     * @returns {Promise<boolean>} - True if started successfully
     */
    async startContinuousListening(onResult, onEnd) {
        // Don't start listening if audio is playing
        if (this.isPlayingAudio) {
            console.log('Audio is playing, not starting continuous listening');
            if (onEnd) onEnd('Audio is playing');
            return false;
        }
        
        if (!this.isSpeechRecognitionSupported()) {
            console.warn('Speech recognition not supported in this environment');
            if (onEnd) onEnd('Speech recognition not supported');
            return false;
        }
        
        try {
            // Store callbacks for later use
            this.speechCallback = onResult;
            this.endCallback = onEnd;
            
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphoneStream = stream;
            
            // Set up audio context for silence detection
            this.setupSilenceDetection(stream);
            
            this.isListening = true;
            this.isContinuousListening = true;
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
                // Only process if we have audio chunks and detected speech
                if (this.audioChunks.length > 0 && this.hasSpeech) {
                    // Create audio blob
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    
                    // Check if the audio is long enough to be meaningful speech
                    // Typically noise or false detections are very short
                    const minMeaningfulDuration = 800; // 800ms minimum
                    
                    // Create an audio element to check duration
                    const audioElement = new Audio(URL.createObjectURL(audioBlob));
                    
                    // Wait for metadata to load to get duration
                    await new Promise(resolve => {
                        audioElement.onloadedmetadata = () => resolve();
                        audioElement.onerror = () => resolve(); // Handle errors
                        
                        // Set a timeout in case metadata loading hangs
                        setTimeout(resolve, 1000);
                    });
                    
                    // Check if audio is long enough
                    const isLongEnough = !audioElement.duration || audioElement.duration > minMeaningfulDuration/1000;
                    
                    // Clean up the temporary audio element
                    URL.revokeObjectURL(audioElement.src);
                    
                    if (isLongEnough) {
                        try {
                            // Convert blob to base64
                            const base64Audio = await this.blobToBase64(audioBlob);
                            
                            // Always use production URL
                            const apiUrl = 'https://duoai.vercel.app';
                        
                            // Send to Whisper API on remote server with production URL
                            const response = await axios.post(`${apiUrl}/api/whisper`, {
                                audioData: base64Audio
                            });
                            
                            const transcript = response.data.transcription;
                            console.log('Whisper transcription:', transcript);
                            
                            // Only process non-empty transcripts that don't contain just punctuation or special characters
                            if (transcript && 
                                transcript.trim() && 
                                /[a-zA-Z0-9]/.test(transcript) && // Contains at least one alphanumeric character
                                this.speechCallback) {
                                this.speechCallback(transcript);
                            } else {
                                console.log('Ignoring empty or invalid transcript:', transcript);
                            }
                        } catch (error) {
                            console.error('Error transcribing audio:', error);
                            if (this.endCallback) this.endCallback(error.message);
                        }
                    } else {
                        console.log('Audio too short, likely noise - ignoring');
                    }
                }
                
                // Reset for next recording if in continuous mode
                this.audioChunks = [];
                this.hasSpeech = false;
                
                if (this.isContinuousListening) {
                    // Start a new recording session
                    this.mediaRecorder.start();
                } else {
                    // Stop all tracks in the stream if not in continuous mode
                    if (this.microphoneStream) {
                        this.microphoneStream.getTracks().forEach(track => track.stop());
                    }
                    this.isListening = false;
                    if (this.endCallback) this.endCallback();
                    
                    // Clean up silence detection
                    this.cleanupSilenceDetection();
                }
            };
            
            // Start recording
            this.mediaRecorder.start();
            console.log('Continuous speech recording started');
            
            return true;
        } catch (error) {
            console.error('Error starting continuous speech recognition:', error);
            this.isListening = false;
            this.isContinuousListening = false;
            if (this.endCallback) this.endCallback(error.message);
            return false;
        }
    }

    /**
     * Stop listening for speech input
     */
    stopListening() {
        this.isContinuousListening = false;
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        } else {
            // If not recording, clean up directly
            if (this.microphoneStream) {
                this.microphoneStream.getTracks().forEach(track => track.stop());
            }
            this.isListening = false;
            if (this.endCallback) this.endCallback();
        }
        
        // Clean up silence detection
        this.cleanupSilenceDetection();
        
        console.log('Speech recording stopped');
    }
    
    /**
     * Toggle continuous listening mode
     * @param {Function} onResult - Callback function for speech results
     * @param {Function} onEnd - Callback function for when listening ends
     * @returns {Promise<boolean>} - True if continuous listening is now active
     */
    async toggleContinuousListening(onResult, onEnd) {
        if (this.isContinuousListening) {
            // Turn off continuous listening
            this.stopListening();
            return false;
        } else {
            // Turn on continuous listening
            return this.startContinuousListening(onResult, onEnd);
        }
    }
    
    /**
     * Set up silence detection
     * @param {MediaStream} stream - The microphone stream
     */
    setupSilenceDetection(stream) {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create analyser with more precise FFT size
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048; // Increased from 1024 for more detailed analysis
            this.analyser.smoothingTimeConstant = 0.7; // Increased from 0.5 for more smoothing
            
            // Create source from stream
            const source = this.audioContext.createMediaStreamSource(stream);
            
            // Add a high-pass filter to reduce background noise
            const highpassFilter = this.audioContext.createBiquadFilter();
            highpassFilter.type = 'highpass';
            highpassFilter.frequency.value = 100; // Increased from 85 to filter more low frequency noise
            
            // Add a low-pass filter to reduce high-frequency noise
            const lowpassFilter = this.audioContext.createBiquadFilter();
            lowpassFilter.type = 'lowpass';
            lowpassFilter.frequency.value = 3000; // Focus on speech frequencies
            
            // Connect the source to the filters, then to the analyser
            source.connect(highpassFilter);
            highpassFilter.connect(lowpassFilter);
            lowpassFilter.connect(this.analyser);
            
            // Start silence detection
            this.silenceDetectionRunning = true;
            this.detectSilence();
        } catch (error) {
            console.error('Error setting up silence detection:', error);
        }
    }
    
    /**
     * Detect silence after speech
     */
    detectSilence() {
        if (!this.silenceDetectionRunning || !this.analyser || this.isPlayingAudio) return;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // Increase noise floor threshold significantly
        const noiseFloorThreshold = 8; // Increased from 5
        // Increase speech threshold to require louder sounds
        const speechThreshold = 20; // Increased from 15
        
        // Increase required consecutive frames for more stable detection
        let consecutiveSilenceFrames = 0;
        let consecutiveSpeechFrames = 0;
        const requiredSilenceFrames = 8; // Increased from 5 (about 130-160ms of silence)
        const requiredSpeechFrames = 5; // Increased from 3 (about 80-100ms of speech)
        
        // Add a counter for total frames with potential speech
        let totalSpeechFrames = 0;
        // Minimum number of speech frames required to consider it actual speech
        const minimumSpeechFrames = 15; // About 250ms of total speech required
        
        const checkVolume = () => {
            if (!this.silenceDetectionRunning) return;
            
            this.analyser.getByteFrequencyData(dataArray);
            
            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            
            // Detect speech (non-silence) with better noise filtering
            if (average > speechThreshold) {
                consecutiveSpeechFrames++;
                consecutiveSilenceFrames = 0;
                
                // Only consider it speech after several consecutive frames above threshold
                if (consecutiveSpeechFrames >= requiredSpeechFrames) {
                    // Clear any existing silence timeout
                    if (this.silenceTimeout) {
                        clearTimeout(this.silenceTimeout);
                        this.silenceTimeout = null;
                    }
                    
                    // Increment total speech frames counter
                    totalSpeechFrames++;
                    
                    // Mark that we've detected speech only if we have enough total speech frames
                    if (totalSpeechFrames >= minimumSpeechFrames && !this.hasSpeech) {
                        console.log('Speech detected, average volume:', average, 'total frames:', totalSpeechFrames);
                        this.hasSpeech = true;
                    }
                }
            } 
            // Detect silence - must be below noise floor to be considered silence
            else if (average < noiseFloorThreshold) {
                consecutiveSilenceFrames++;
                consecutiveSpeechFrames = 0;
                
                // Only consider it silence after several consecutive frames below threshold
                if (consecutiveSilenceFrames >= requiredSilenceFrames && this.hasSpeech) {
                    // Start silence timeout if not already started
                    if (!this.silenceTimeout) {
                        console.log('Potential silence detected after speech, average volume:', average);
                        this.silenceTimeout = setTimeout(() => {
                            // Only stop recording if we had enough total speech frames
                            if (totalSpeechFrames >= minimumSpeechFrames) {
                                console.log('Silence confirmed after speech, stopping recording. Total speech frames:', totalSpeechFrames);
                                
                                // Stop current recording to process the audio
                                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                                    this.mediaRecorder.stop();
                                }
                            } else {
                                console.log('Ignoring silence after insufficient speech (frames:', totalSpeechFrames, ')');
                                // Reset speech detection but don't stop recording
                                this.hasSpeech = false;
                                totalSpeechFrames = 0;
                            }
                            
                            this.silenceTimeout = null;
                        }, this.silenceThreshold);
                    }
                }
            }
            // In the "gray area" between noise floor and speech threshold
            else {
                // Reset consecutive frame counters in the ambiguous range
                consecutiveSpeechFrames = 0;
                consecutiveSilenceFrames = 0;
            }
            
            // Continue checking if still running
            if (this.silenceDetectionRunning) {
                requestAnimationFrame(checkVolume);
            }
        };
        
        // Start checking volume
        checkVolume();
    }
    
    /**
     * Clean up silence detection resources
     */
    cleanupSilenceDetection() {
        this.silenceDetectionRunning = false;
        
        if (this.silenceTimeout) {
            clearTimeout(this.silenceTimeout);
            this.silenceTimeout = null;
        }
        
        if (this.audioContext) {
            try {
                this.audioContext.close();
            } catch (e) {
                console.warn('Error closing audio context:', e);
            }
            this.audioContext = null;
        }
        
        this.analyser = null;
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
            // Set flag that audio is playing
            this.isPlayingAudio = true;
            
            // If continuous listening is active, temporarily pause it
            let wasListening = false;
            if (this.isListening && this.isContinuousListening) {
                console.log('Pausing continuous listening during audio playback');
                wasListening = true;
                // Don't call stopListening() as that would reset isContinuousListening
                // Instead, just stop the current recording session
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
                // Clean up silence detection but maintain continuous listening state
                this.cleanupSilenceDetection();
                this.isListening = false;
            }
            
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
            
            // Always use production URL
            const apiUrl = 'https://duoai.vercel.app';
            console.log(`Sending TTS request to ${apiUrl}/api/elevenlabs/tts`);
            
            // Use the server as a proxy to avoid exposing API key in client
            try {
                console.log(`Sending TTS request to server with voice ID: ${this.voiceId}`);
                const response = await axios.post(`${apiUrl}/api/elevenlabs/tts`, {
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
                            
                            // Add this to ensure audio continues playing when window is minimized
                            if (this.isElectronEnv) {
                                // In Electron, we need to set this property to ensure audio continues
                                this.audioElement.preservesPitch = false; // This is a dummy property to access the element
                                
                                // Use the ipcRenderer to tell the main process to keep the app running
                                if (ipcRenderer) {
                                    ipcRenderer.send('keep-app-running', true);
                                }
                            }
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
                    try {
                        this.audioElement.src = audioUrl;
                    } catch (error) {
                        console.error('Error setting audio source (possible CSP issue):', error);
                        URL.revokeObjectURL(audioUrl);
                        return resolve();
                    }
                
                    // Add specific error handler for CSP issues
                    this.audioElement.addEventListener('error', (e) => {
                        console.error('Audio element error:', e);
                        if (e.target.error && e.target.error.code === 4) {
                            console.error('CSP error detected when loading audio');
                            
                            // CSP workaround for Electron: Use the ipcRenderer to play audio through the main process
                            try {
                                console.log('Attempting CSP workaround with temporary file playback');
                                
                                // Clean up the old blob URL
                                URL.revokeObjectURL(audioUrl);
                                
                                if (this.isElectronEnv && ipcRenderer) {
                                    // Convert blob to array buffer for sending through IPC
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        try {
                                            const arrayBuffer = event.target.result;
                                            console.log('Created array buffer for audio, length:', arrayBuffer.byteLength);
                                            
                                            // Send the audio data to the main process for playback
                                            ipcRenderer.send('play-audio-file', {
                                                buffer: Array.from(new Uint8Array(arrayBuffer)),
                                                volume: this.volume
                                            });
                                            
                                            // Set up a listener for when audio playback is complete
                                            ipcRenderer.once('audio-playback-complete', () => {
                                                console.log('Audio playback ended (main process)');
                                                
                                                // Tell main process we're done with audio
                                                ipcRenderer.send('keep-app-running', false);
                                                
                                                // Reset audio playing flag
                                                this.isPlayingAudio = false;
                                                
                                                // Resume continuous listening if it was active before
                                                if (wasListening && this.isContinuousListening) {
                                                    console.log('Resuming continuous listening after audio playback');
                                                    this.startContinuousListening(this.speechCallback, this.endCallback)
                                                        .catch(err => console.error('Error resuming continuous listening:', err));
                                                }
                                                
                                                // Set up proactive messaging timer after audio playback ends
                                                if (typeof setupProactiveMessaging === 'function') {
                                                    setupProactiveMessaging();
                                                }
                                                
                                                resolve();
                                            });
                                        } catch (error) {
                                            console.error('Error setting up main process audio playback:', error);
                                            resolve();
                                        }
                                    };
                                    
                                    reader.onerror = (readerError) => {
                                        console.error('Error reading blob as array buffer:', readerError);
                                        resolve();
                                    };
                                    
                                    // Start reading the blob as array buffer
                                    reader.readAsArrayBuffer(audioBlob);
                                    return; // Exit early as we're handling this asynchronously
                                } else {
                                    console.warn('Electron environment not detected, cannot use main process audio playback');
                                }
                            } catch (workaroundError) {
                                console.error('CSP workaround failed:', workaroundError);
                            }
                        }
                        
                        URL.revokeObjectURL(audioUrl);
                        
                        // Tell main process we're done with audio
                        if (this.isElectronEnv && ipcRenderer) {
                            ipcRenderer.send('keep-app-running', false);
                        }
                        
                        resolve();
                    });
                
                    this.audioElement.oncanplaythrough = () => {
                        console.log('Audio can play through, starting playback');
                        this.audioElement.play().catch(error => {
                            console.error('Error playing audio:', error);
                            URL.revokeObjectURL(audioUrl);
                            
                            // Tell main process we're done with audio
                            if (this.isElectronEnv && ipcRenderer) {
                                ipcRenderer.send('keep-app-running', false);
                            }
                            
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
                        
                        // Tell main process we're done with audio
                        if (this.isElectronEnv && ipcRenderer) {
                            ipcRenderer.send('keep-app-running', false);
                        }
                        
                        // Reset audio playing flag
                        this.isPlayingAudio = false;
                        
                        // Resume continuous listening if it was active before
                        if (wasListening && this.isContinuousListening) {
                            console.log('Resuming continuous listening after audio playback');
                            this.startContinuousListening(this.speechCallback, this.endCallback)
                                .catch(err => console.error('Error resuming continuous listening:', err));
                        }
                        
                        // Set up proactive messaging timer after audio playback ends
                        if (typeof setupProactiveMessaging === 'function') {
                            setupProactiveMessaging();
                        }
                        
                        resolve();
                    };
                    
                    this.audioElement.onerror = (error) => {
                        console.error('Error loading audio:', error);
                        URL.revokeObjectURL(audioUrl);
                        
                        // Tell main process we're done with audio
                        if (this.isElectronEnv && ipcRenderer) {
                            ipcRenderer.send('keep-app-running', false);
                        }
                        
                        // Reset audio playing flag
                        this.isPlayingAudio = false;
                        
                        // Resume continuous listening if it was active before
                        if (wasListening && this.isContinuousListening) {
                            console.log('Resuming continuous listening after audio error');
                            this.startContinuousListening(this.speechCallback, this.endCallback)
                                .catch(err => console.error('Error resuming continuous listening:', err));
                        }
                        
                        resolve();
                    };
                    
                    // Also add a timeout in case the audio never loads or ends
                    setTimeout(() => {
                        if (this.isPlayingAudio) {
                            console.warn('Audio playback timeout reached, resuming listening');
                            this.isPlayingAudio = false;
                            
                            // Resume continuous listening if it was active before
                            if (wasListening && this.isContinuousListening) {
                                console.log('Resuming continuous listening after timeout');
                                this.startContinuousListening(this.speechCallback, this.endCallback)
                                    .catch(err => console.error('Error resuming continuous listening:', err));
                            }
                            
                            resolve();
                        }
                    }, 30000); // 30 second timeout
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
    } catch (outerError) {
        // Reset audio playing flag in case of error
        this.isPlayingAudio = false;
        // Add this catch block to fix the syntax error
        console.error('Unexpected error in speak method:', outerError);
        return Promise.resolve();
    }
  }
    /**
     * Set the volume for speech
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    setVolume(volume) {
        try {
            // Validate input
            if (volume === undefined || volume === null) {
                console.warn('Volume value is undefined or null, using default');
                volume = 0.5;
            }
            
            // Parse and clamp volume value
            let parsedVolume;
            try {
                parsedVolume = parseFloat(volume);
                if (isNaN(parsedVolume)) {
                    console.warn(`Invalid volume value: ${volume}, using default`);
                    parsedVolume = 0.5;
                }
            } catch (parseError) {
                console.warn(`Error parsing volume value: ${volume}`, parseError);
                parsedVolume = 0.5;
            }
            
            // Clamp volume between 0 and 1
            this.volume = Math.max(0, Math.min(1, parsedVolume));
            console.log(`Setting volume to ${this.volume}`);
            
            // Only try to set volume on audio element if we're in a browser environment
            if (this.hasAudioAPI && this.audioElement) {
                try {
                    this.audioElement.volume = this.volume;
                } catch (error) {
                    console.warn('Error setting audio element volume:', error);
                }
            }
        } catch (error) {
            console.error('Error setting volume:', error);
            // Ensure volume has a valid value even after error
            if (typeof this.volume !== 'number' || isNaN(this.volume)) {
                this.volume = 0.5;
            }
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
            // First check if we're in a browser environment
            if (!this.isBrowserEnv) {
                console.log('Not in browser environment, speech recognition not supported');
                return false;
            }
            
            // Safely check for navigator
            let hasNavigator = false;
            try {
                hasNavigator = typeof navigator !== 'undefined';
            } catch (e) {
                console.warn('Error checking navigator:', e.message);
            }
            
            if (!hasNavigator) {
                console.log('Navigator API not available, speech recognition not supported');
                return false;
            }
            
            // More comprehensive check for speech recognition support with safe property access
            let hasMediaDevices = false;
            try {
                hasMediaDevices = !!navigator.mediaDevices && 
                                 !!navigator.mediaDevices.getUserMedia;
            } catch (e) {
                console.warn('Error checking mediaDevices:', e.message);
            }
            
            // Check for getUserMedia support
            let hasGetUserMedia = false;
            try {
                hasGetUserMedia = !!(navigator.getUserMedia || 
                                   navigator.webkitGetUserMedia || 
                                   navigator.mozGetUserMedia || 
                                   navigator.msGetUserMedia);
            } catch (e) {
                console.warn('Error checking getUserMedia:', e.message);
            }
            
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
            // First check if we have network capabilities
            const hasNetwork = this.isBrowserEnv || this.isNodeEnv || this.isElectronEnv;
            
            if (!hasNetwork) {
                console.log('No network capabilities detected, ElevenLabs not available');
                return false;
            }
            
            // Check if axios is available for API calls
            let hasAxios = false;
            try {
                hasAxios = !!axios && typeof axios.post === 'function';
            } catch (e) {
                console.warn('Error checking axios availability:', e.message);
            }
            
            if (!hasAxios) {
                console.log('axios not available, ElevenLabs not available');
                return false;
            }
            
            // Check if the client exists and is properly initialized
            let clientExists = false;
            try {
                clientExists = !!this.elevenLabsClient;
            } catch (e) {
                console.warn('Error checking ElevenLabs client:', e.message);
            }
            
            // Additional check for required properties/methods on the client
            let clientHasVoices = false;
            try {
                clientHasVoices = clientExists && 
                                 !!this.elevenLabsClient.voices && 
                                 typeof this.elevenLabsClient.voices.getAll === 'function';
            } catch (e) {
                console.warn('Error checking ElevenLabs client voices API:', e.message);
            }
            
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
            // Skip audio cleanup if not in browser environment
            if (!this.isBrowserEnv) {
                console.log('Not in browser environment, skipping audio cleanup');
                return;
            }
            
            // Clean up silence detection
            this.cleanupSilenceDetection();
            
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
            
            // Clean up microphone stream
            if (this.microphoneStream) {
                try {
                    this.microphoneStream.getTracks().forEach(track => track.stop());
                    console.log('Stopped microphone stream tracks');
                } catch (streamError) {
                    console.warn('Error stopping microphone stream:', streamError);
                }
                this.microphoneStream = null;
            }
            
            console.log('Cleanup completed successfully');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
}

// Create a more comprehensive fallback implementation
const fallbackImplementation = {
    speak: () => {
        console.log('Fallback implementation: speak called');
        return Promise.resolve();
    },
    setVolume: (volume) => {
        console.log(`Fallback implementation: setVolume called with ${volume}`);
    },
    setVoice: (voiceId) => {
        console.log(`Fallback implementation: setVoice called with ${voiceId}`);
    },
    cleanup: () => {
        console.log('Fallback implementation: cleanup called');
    },
    isElevenLabsAvailable: () => {
        console.log('Fallback implementation: isElevenLabsAvailable called');
        return false;
    },
    isSpeechRecognitionSupported: () => {
        console.log('Fallback implementation: isSpeechRecognitionSupported called');
        return false;
    },
    startListening: (onResult, onEnd) => {
        console.log('Fallback implementation: startListening called');
        if (onEnd) setTimeout(() => onEnd('Speech recognition not available'), 0);
    },
    stopListening: () => {
        console.log('Fallback implementation: stopListening called');
    },
    initElevenLabs: () => {
        console.log('Fallback implementation: initElevenLabs called');
        return Promise.resolve(false);
    }
};

// Create a singleton instance with better error handling
let instance;

// Wrap the entire initialization in a try-catch
try {
    console.log('Creating SpeechManager instance');
    
    // More robust environment detection with defaults
    let isBrowser = false;
    let hasAudioAPI = false;
    let isNode = false;
    let isElectron = false;
    
    // Safely detect browser environment
    try {
        isBrowser = typeof window !== 'undefined';
    } catch (e) {
        console.warn('Error detecting browser environment:', e.message);
    }
    
    // Safely detect Audio API
    try {
        hasAudioAPI = typeof Audio !== 'undefined';
    } catch (e) {
        console.warn('Error detecting Audio API:', e.message);
    }
    
    // Safely detect Node.js
    try {
        isNode = typeof process !== 'undefined' && 
                process.versions && 
                process.versions.node;
    } catch (e) {
        console.warn('Error detecting Node.js environment:', e.message);
    }
    
    // Safely detect Electron
    try {
        isElectron = typeof process !== 'undefined' && 
                    process.versions && 
                    process.versions.electron;
    } catch (e) {
        console.warn('Error detecting Electron environment:', e.message);
    }
    
    console.log(`Environment detection: Browser: ${isBrowser}, Audio API: ${hasAudioAPI}, Node: ${isNode}, Electron: ${isElectron}`);
    
    // Create the appropriate instance based on environment
    if (isBrowser && hasAudioAPI) {
        try {
            console.log('Audio API is available, creating full implementation');
            instance = new SpeechManager();
            console.log('SpeechManager instance created successfully');
        } catch (instanceError) {
            console.error('Error creating SpeechManager instance:', instanceError);
            console.warn('Falling back to fallback implementation due to instance creation error');
            instance = fallbackImplementation;
        }
    } else {
        console.warn('Audio API is not available in this environment, using fallback implementation');
        instance = fallbackImplementation;
    }
} catch (error) {
    console.error('Critical error during SpeechManager initialization:', error);
    console.error('Stack trace:', error.stack);
    console.warn('Using fallback implementation for SpeechManager due to critical error');
    instance = fallbackImplementation;
}

module.exports = instance;
