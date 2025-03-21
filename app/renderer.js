// Authentication-related variables
let authToken = localStorage.getItem('duoai_auth_token');
let currentUsername = localStorage.getItem('duoai_username') || 'anonymous';

// Function to check if user is authenticated
function isAuthenticated() {
  return !!authToken;
}

// Function to handle logout
function logout() {
  localStorage.removeItem('duoai_auth_token');
  localStorage.removeItem('duoai_username');
  authToken = null;
  currentUsername = 'anonymous';
  
  // Redirect to login page
  window.location.href = 'login.html';
}

// Function to verify token validity
async function verifyToken() {
  if (!authToken) return false;
  
  try {
    // Use different URLs based on environment
    let apiUrl;
    if (isElectron()) {
      apiUrl = 'https://duogaming.ai/api/verify-token';
    } else {
      apiUrl = '/api/verify-token';
    }
    
    const response = await fetch(`${apiUrl}?token=${authToken}`);
    const data = await response.json();
    
    if (!data.success) {
      console.log('Token invalid or expired');
      logout();
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error verifying token:', error);
    return false;
  }
}

// Define sendMessage as a global variable so it's accessible from mediaRecorder.onstop
let sendMessage;

// Function to detect if running in Electron environment
function isElectron() {
  // Renderer process
  if (typeof window !== 'undefined' && typeof window.process === 'object' && window.process.type === 'renderer') {
    return true;
  }
  // Main process
  if (typeof process !== 'undefined' && typeof process.versions === 'object' && !!process.versions.electron) {
    return true;
  }
  // Detect the user agent when the `nodeIntegration` option is set to false
  if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
    return true;
  }
  return false;
}

// Function to check if an API endpoint is available
async function checkApiAvailability(apiUrl) {
  try {
    const response = await fetch(apiUrl, {
      method: 'OPTIONS',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return response.ok;
  } catch (error) {
    console.error(`API at ${apiUrl} is not available:`, error);
    return false;
  }
}

// Function to fetch messages from the API
async function fetchMessages(username = currentUsername, character = 'Zephyr', count = 20) {
  try {
    // Use different URLs based on environment
    let apiUrl;
    if (isElectron()) {
      // When running in Electron, use the full URL to the production API
      apiUrl = 'https://duogaming.ai/api/messages';
    } else {
      // When running in a browser, use a relative URL
      apiUrl = '/api/messages';
    }
    
    // Log the URL being used
    console.log('Fetching messages from:', apiUrl);
    
    const response = await fetch(`${apiUrl}?username=${encodeURIComponent(username)}&character=${encodeURIComponent(character)}&count=${count}&token=${authToken || ''}`);
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.messages || [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

// Variable to store conversation history
let conversationHistory = [];

// Variables for microphone recording
let isRecording = false;
let recordingInterval = null;
let isWaitingForResponse = false;
let isPlayingAudio = false;
let mediaRecorder = null;
let audioChunks = [];
let micEnabled = true;
let micToggleBtn;

// Speech-to-text function using ElevenLabs API
async function speechToText(audioBase64) {
  try {
    // Use different URLs based on environment
    let apiUrl;
    if (isElectron()) {
      // When running in Electron, use the full URL to the production API
      apiUrl = 'https://duogaming.ai/api/utils/stt';
    } else {
      // When running in a browser, use a relative URL
      apiUrl = '/api/utils/stt';
    }
    
    // Log the URL being used
    console.log('Calling STT API at:', apiUrl);
    
    // Log the size of the audio data being sent
    console.log('Audio data size:', audioBase64.length, 'bytes');
    
    // Check if audio data is too large
    if (audioBase64.length > 10 * 1024 * 1024) { // 10MB limit
      console.warn('Audio data exceeds 10MB, may cause issues with API');
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        audio: audioBase64,
        // Add additional parameters that might be required by the API
        format: 'webm', // Specify the audio format
        language: 'en'  // Specify the language
      }),
    });
    
    if (!response.ok) {
      // Get more detailed error information
      let errorDetails = '';
      try {
        const errorData = await response.json();
        errorDetails = JSON.stringify(errorData);
      } catch (e) {
        errorDetails = await response.text();
      }
      
      console.error(`STT API error (${response.status}):`, errorDetails);
      throw new Error(`API returned ${response.status}: ${errorDetails}`);
    }
    
    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error('Error calling STT API:', error);
    throw error;
  }
}

// Function to handle microphone recording and STT
async function setupMicrophoneRecording() {
  // Initialize mic toggle button
  micToggleBtn = document.getElementById('mic-toggle-btn');
  if (micToggleBtn) {
    micToggleBtn.addEventListener('click', toggleMicrophone);
  }
  
  // Check if STT API is available
  let apiUrl = isElectron() ? 'https://duogaming.ai/api/utils/stt' : '/api/utils/stt';
  const isApiAvailable = await checkApiAvailability(apiUrl);
  
  if (!isApiAvailable) {
    console.warn('Speech-to-text API is not available. Voice input will be limited.');
    
    // Show warning in chat
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
      const warningMsg = document.createElement('div');
      warningMsg.classList.add('message', 'system-message');
      warningMsg.textContent = 'Speech-to-text service is currently unavailable. Voice input will not work.';
      chatMessages.appendChild(warningMsg);
    }
    
    // Update status indicator
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-indicator span');
    if (statusDot && statusText) {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'STT unavailable';
    }
    
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('Media devices API not supported in this browser');
    return;
  }
  
  try {
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });
    console.log('Microphone access granted');
    
    // Create media recorder with options
    const options = { mimeType: 'audio/webm' };
    try {
      mediaRecorder = new MediaRecorder(stream, options);
      console.log('MediaRecorder created with mime type:', options.mimeType);
    } catch (e) {
      console.warn('Failed to create MediaRecorder with specified options, trying default:', e);
      mediaRecorder = new MediaRecorder(stream);
    }
    
    // Handle data available event
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        console.log(`Received audio chunk: ${event.data.size} bytes`);
      }
    };
    
    // Add error handler
    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
      // Try to restart recording
      setTimeout(startContinuousRecording, 2000);
    };
    
    // Function to detect silence and non-speech sounds in audio
    async function detectSilence(audioBlob, silenceThreshold = 0.01, speechThreshold = 0.03) {
      return new Promise((resolve) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const fileReader = new FileReader();
        
        fileReader.onload = function() {
          const arrayBuffer = this.result;
          
          audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
            const channelData = audioBuffer.getChannelData(0); // Get data from first channel
            const sampleRate = audioBuffer.sampleRate;
            const duration = audioBuffer.duration;
            
            // Calculate RMS (root mean square) to determine audio level
            let sum = 0;
            for (let i = 0; i < channelData.length; i++) {
              sum += channelData[i] * channelData[i];
            }
            const rms = Math.sqrt(sum / channelData.length);
            
            console.log('Audio RMS level:', rms);
            
            // Check if the audio is too short to be meaningful speech
            const isTooShort = duration < 0.5; // Less than 0.5 seconds
            
            // Check if RMS is below silence threshold
            const isSilence = rms < silenceThreshold;
            
            // Check for consistent audio patterns that might indicate breathing/background noise
            // by analyzing the frequency of zero-crossings and amplitude variations
            let zeroCrossings = 0;
            let previousSample = 0;
            let variationSum = 0;
            
            // Sample the audio at regular intervals to save processing time
            const samplingRate = Math.floor(channelData.length / 100);
            for (let i = 0; i < channelData.length; i += samplingRate) {
              // Count zero crossings (when the signal changes from positive to negative or vice versa)
              if ((previousSample < 0 && channelData[i] >= 0) || (previousSample >= 0 && channelData[i] < 0)) {
                zeroCrossings++;
              }
              previousSample = channelData[i];
              
              // Calculate variation between consecutive samples
              if (i > 0) {
                variationSum += Math.abs(channelData[i] - channelData[i - samplingRate]);
              }
            }
            
            // Normalize zero crossings and variations to the audio length
            const normalizedCrossings = zeroCrossings / (channelData.length / samplingRate);
            const averageVariation = variationSum / (channelData.length / samplingRate);
            
            console.log('Normalized zero crossings:', normalizedCrossings);
            console.log('Average variation:', averageVariation);
            
            // Breathing and background noise often have:
            // 1. Low to medium RMS (above silence but below clear speech)
            // 2. Low variation (relatively consistent sound)
            // 3. Low to medium zero-crossing rate
            const isLikelyNoise = (rms > silenceThreshold && rms < speechThreshold) && 
                                  (averageVariation < 0.02) && 
                                  (normalizedCrossings < 0.4 || normalizedCrossings > 0.8);
            
            // Determine if this audio should be ignored
            const shouldIgnore = isSilence || isTooShort || isLikelyNoise;
            
            console.log('Audio analysis:', {
              duration,
              rms,
              isSilence,
              isTooShort,
              isLikelyNoise,
              shouldIgnore
            });
            
            resolve(shouldIgnore);
          }, (err) => {
            console.error('Error decoding audio data:', err);
            resolve(false); // Assume not silence on error
          });
        };
        
        fileReader.readAsArrayBuffer(audioBlob);
      });
    }
    
    // Handle recording stop event
    mediaRecorder.onstop = async () => {
      // If microphone is disabled by user, don't process audio
      if (!micEnabled && !isWaitingForResponse && !isPlayingAudio) {
        console.log('Microphone disabled, not processing audio');
        return;
      }
      
      // Create audio blob from chunks
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];
      
      // Log the size of the audio blob
      console.log(`Audio blob size: ${audioBlob.size} bytes`);
      
      // Check if the audio is mostly silence or non-speech sounds
      const shouldIgnore = await detectSilence(audioBlob);
      
      if (shouldIgnore) {
        console.log('Detected silence or non-speech audio, skipping transcription');
        return;
      }
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result.split(',')[1];
          
          // Call speech-to-text API
          try {
            const transcription = await speechToText(base64Audio);
            console.log('Transcription:', transcription);
            
            // If we got text, put it in the input field
            if (transcription && transcription.trim()) {
              const messageInput = document.getElementById('message-input');
              messageInput.value = transcription;
              messageInput.focus();
              
              // Auto-send if more than 4 words
              const wordCount = transcription.trim().split(/\s+/).length;
              if (wordCount > 4) {
                console.log(`Auto-sending message with ${wordCount} words`);
                sendMessage();
              }
            }
          } catch (error) {
            console.error('Error transcribing audio:', error);
            
            // Show a user-friendly error message in the chat
            const chatMessages = document.getElementById('chat-messages');
            if (chatMessages) {
              const errorMsg = document.createElement('div');
              errorMsg.classList.add('message', 'system-message');
              errorMsg.textContent = 'Sorry, I had trouble understanding what you said. Please try again or type your message.';
              chatMessages.appendChild(errorMsg);
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }
          }
        } catch (error) {
          console.error('Error processing audio data:', error);
        }
      };
      
      reader.onerror = (error) => {
        console.error('Error reading audio data:', error);
      };
    };
    
    // Start continuous recording
    startContinuousRecording();
    
    // Add status indicator update
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-indicator span');
    if (statusDot && statusText) {
      statusDot.className = 'status-dot listening';
      statusText.textContent = 'Listening...';
    }
    
  } catch (error) {
    console.error('Error accessing microphone:', error);
    
    // Update status indicator to show error
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-indicator span');
    if (statusDot && statusText) {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Microphone access denied';
    }
    
    // Show error message in chat
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
      const errorMsg = document.createElement('div');
      errorMsg.classList.add('message', 'system-message');
      errorMsg.textContent = 'Microphone access is required for voice input. Please allow microphone access and reload the page.';
      chatMessages.appendChild(errorMsg);
    }
  }
}

// Function to toggle microphone
function toggleMicrophone() {
  if (!mediaRecorder) {
    console.warn('Media recorder not initialized');
    return;
  }
  
  micEnabled = !micEnabled;
  
  // Update button appearance
  if (micToggleBtn) {
    if (micEnabled) {
      micToggleBtn.classList.add('active');
      micToggleBtn.classList.remove('disabled');
      micToggleBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    } else {
      micToggleBtn.classList.remove('active');
      micToggleBtn.classList.add('disabled');
      micToggleBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    }
  }
  
  // Update status indicator
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-indicator span');
  
  if (statusDot && statusText) {
    if (micEnabled) {
      statusDot.className = 'status-dot listening';
      statusText.textContent = 'Listening...';
    } else {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Mic off';
    }
  }
  
  // Handle recording state
  if (micEnabled) {
    // Resume recording
    if (mediaRecorder.state !== 'recording') {
      audioChunks = [];
      mediaRecorder.start();
      isRecording = true;
      console.log('Resumed recording after toggle');
    }
  } else {
    // Pause recording
    if (mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      isRecording = false;
      console.log('Stopped recording due to toggle');
    }
  }
}

// Function to start continuous recording
function startContinuousRecording() {
  if (!mediaRecorder) {
    console.error('Media recorder not initialized');
    return;
  }

  try {
    // Only start recording if mic is enabled
    if (micEnabled) {
      // Start recording immediately
      audioChunks = [];
      if (mediaRecorder.state !== 'recording') {
        mediaRecorder.start();
        isRecording = true;
        console.log('Started continuous recording');
      } else {
        console.log('Recorder is already recording');
      }
    } else {
      console.log('Microphone is disabled, not starting recording');
    }
    
    // Set up interval to process audio chunks every 10 seconds
    // but only when not waiting for response or playing audio
    if (recordingInterval) {
      clearInterval(recordingInterval);
    }
    
    recordingInterval = setInterval(() => {
      if (isWaitingForResponse || isPlayingAudio) {
        console.log('Skipping audio processing: ' + 
                   (isWaitingForResponse ? 'waiting for response' : 'playing audio'));
        return;
      }
      
      // Only process if mic is enabled
      if (micEnabled) {
        if (isRecording && mediaRecorder.state === 'recording') {
          // Stop current recording
          mediaRecorder.stop();
          isRecording = false;
          console.log('Stopped recording for processing');
          
          // Start a new recording after a short delay
          setTimeout(() => {
            if (mediaRecorder.state !== 'recording' && micEnabled) {
              audioChunks = [];
              mediaRecorder.start();
              isRecording = true;
              console.log('Resumed continuous recording');
            }
          }, 500);
        } else {
          console.log('Cannot stop recording: not currently recording');
          // Try to restart recording if it's not active
          if (mediaRecorder.state !== 'recording') {
            audioChunks = [];
            mediaRecorder.start();
            isRecording = true;
            console.log('Restarted continuous recording');
          }
        }
      } else {
        console.log('Microphone is disabled, skipping recording cycle');
      }
    }, 10000); // Process audio every 10 seconds
  } catch (error) {
    console.error('Error in continuous recording:', error);
    // Try to recover by restarting in 5 seconds
    setTimeout(startContinuousRecording, 5000);
  }
}

// Function to capture a screenshot of the entire screen
async function captureScreenshot() {
  if (!isElectron()) {
    console.log('Screenshot capture is only available in Electron');
    return null;
  }
  
  try {
    console.log('Starting screenshot capture process');
    
    // Check if electronAPI is available
    if (!window.electronAPI || !window.electronAPI.getScreenSources) {
      console.error('electronAPI.getScreenSources is not available');
      return null;
    }
    
    // Access Electron's desktopCapturer through the preload script
    console.log('Calling getScreenSources');
    const sources = await window.electronAPI.getScreenSources();
    console.log('Got screen sources:', sources.length);
    
    if (!sources || sources.length === 0) {
      console.error('No screen sources returned');
      return null;
    }
    
    // Find the screen source (usually the first one)
    const screenSource = sources.find(source => source.type === 'screen');
    
    if (!screenSource) {
      console.error('No screen source found in sources');
      return null;
    }
    
    console.log('Using screen source:', screenSource.id);
    
    // Create a video element to capture the stream
    const video = document.createElement('video');
    video.style.display = 'none';
    document.body.appendChild(video);
    
    console.log('Requesting media stream');
    
    // Get the stream for the screen
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: screenSource.id
        }
      }
    });
    
    console.log('Got media stream');
    
    // Connect the stream to the video element
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      console.log('Video metadata loaded, playing video');
      video.play();
    };
    
    // Wait for the video to start playing
    await new Promise((resolve, reject) => {
      video.onplaying = () => {
        console.log('Video is playing');
        resolve();
      };
      video.onerror = (err) => {
        console.error('Video error:', err);
        reject(err);
      };
      // Timeout in case onplaying doesn't fire
      setTimeout(() => {
        console.log('Video play timeout, continuing anyway');
        resolve();
      }, 1000);
    });
    
    console.log('Creating canvas');
    
    // Create a canvas to draw the video frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;  // Default to 1280 if width is 0
    canvas.height = video.videoHeight || 720; // Default to 720 if height is 0
    
    console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
    
    // Draw the current video frame to the canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    console.log('Getting image data');
    
    // Get the image data as base64
    const imageData = canvas.toDataURL('image/jpeg', 0.7); // Lower quality for smaller size
    
    console.log('Image data length:', imageData.length);
    
    // Clean up
    stream.getTracks().forEach(track => track.stop());
    document.body.removeChild(video);
    
    // Return the base64 image data (remove the data:image/jpeg;base64, prefix)
    const base64Data = imageData.split(',')[1];
    console.log('Base64 data length:', base64Data.length);
    
    return base64Data;
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is authenticated
  if (!isAuthenticated()) {
    // Redirect to login page
    window.location.href = 'login.html';
    return;
  }
  
  // Verify token validity
  const isValid = await verifyToken();
  if (!isValid) {
    // Token is invalid, redirect to login page
    window.location.href = 'login.html';
    return;
  }
  
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const chatMessages = document.getElementById('chat-messages');
  const menuTab = document.getElementById('menu-tab');
  const appContainer = document.querySelector('.app-container');
  
  // Add user info to the UI
  const userInfoElement = document.createElement('div');
  userInfoElement.classList.add('user-info');
  userInfoElement.innerHTML = `
    <span class="username">${currentUsername}</span>
    <button id="logout-btn" class="logout-btn">
      <i class="fas fa-sign-out-alt"></i>
    </button>
  `;
  document.querySelector('.status-bar').appendChild(userInfoElement);
  
  // Add logout button event listener
  document.getElementById('logout-btn').addEventListener('click', logout);
  
  // Fetch conversation history
  conversationHistory = await fetchMessages();
  
  // Display conversation history in the chat
  if (conversationHistory.length > 0) {
    // Clear any default messages
    chatMessages.innerHTML = '';
    
    // Add each message to the chat
    conversationHistory.forEach(msg => {
      addMessage(msg.content, msg.role === 'user' ? 'user' : 'bot');
    });
  } else {
    // Add a welcome message if no history
    addMessage('Hello! How can I help you today?', 'bot');
  }
  
  // Initialize microphone recording
  setupMicrophoneRecording();
  
  // Text-to-speech function using ElevenLabs API
  async function textToSpeech(text, voiceId) {
    try {
      // Use different URLs based on environment
      let apiUrl;
      if (isElectron()) {
        // When running in Electron, use the full URL to the production API
        apiUrl = 'https://duogaming.ai/api/utils/tts';
      } else {
        // When running in a browser, use a relative URL
        apiUrl = '/api/utils/tts';
      }
      
      // Log the URL being used
      console.log('Calling TTS API at:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text, 
          voiceId: voiceId || 'pNInz6obpgDQGcFmaJgB' 
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      console.error('Error calling TTS API:', error);
      throw error;
    }
  }


  // Define the sendMessage function and assign it to the global variable
  sendMessage = async function() {
    const message = messageInput.value.trim();
    if (message) {
      // Add user message to chat
      addMessage(message, 'user');
      
      // Clear input field
      messageInput.value = '';
      
      // Show loading indicator
      const loadingElement = document.createElement('div');
      loadingElement.classList.add('message', 'bot-message', 'loading');
      loadingElement.textContent = 'Thinking...';
      chatMessages.appendChild(loadingElement);
      
      // Scroll to the bottom of the chat
      chatMessages.scrollTop = chatMessages.scrollHeight;
      
      // Set waiting flag
      isWaitingForResponse = true;
      
      // Capture screenshot if in Electron
      let screenshot = null;
      if (isElectron()) {
        console.log('Capturing screenshot...');
        try {
          screenshot = await captureScreenshot();
          console.log('Screenshot captured:', screenshot ? `${screenshot.substring(0, 50)}...` : 'failed');
        } catch (error) {
          console.error('Error capturing screenshot:', error);
        }
      }
      
      // Call the send-message API
      let apiUrl;
      if (isElectron()) {
        apiUrl = 'https://duogaming.ai/api/send-message';
      } else {
        apiUrl = '/api/send-message';
      }
      
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          username: currentUsername,
          character: document.getElementById('character-select').value,
          screenshot: screenshot,
          token: authToken // Include the auth token
        }),
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.message || `Error: ${response.status}`);
          });
        }
        return response.json();
      })
      .then(data => {
        // Remove loading indicator
        chatMessages.removeChild(loadingElement);
        
        // Add bot response to chat
        addMessage(data.response, 'bot');
        
        // Update conversation history
        conversationHistory.push({ role: 'user', content: message });
        conversationHistory.push({ role: 'assistant', content: data.response });
        
        // Display rate limit information if needed
        if (data.remaining <= 5) {
          const limitMessage = `You have ${data.remaining} messages remaining today.`;
          const limitElement = document.createElement('div');
          limitElement.classList.add('message', 'system-message');
          limitElement.textContent = limitMessage;
          chatMessages.appendChild(limitElement);
        }
        
        // Reset waiting flag
        isWaitingForResponse = false;
        
        // Set playing flag
        isPlayingAudio = true;
        
        // Convert bot response to speech
        return textToSpeech(data.response);
      })
      .then(audioUrl => {
        const audio = new Audio(audioUrl);
        
        // Handle audio playback events
        audio.onended = () => {
          console.log('Audio playback ended');
          isPlayingAudio = false;
        };
        
        audio.onerror = () => {
          console.error('Audio playback error');
          isPlayingAudio = false;
        };
        
        audio.play();
      })
      .catch(error => {
        // Remove loading indicator
        if (loadingElement.parentNode) {
          chatMessages.removeChild(loadingElement);
        }
        
        // Reset flags
        isWaitingForResponse = false;
        isPlayingAudio = false;
        
        console.error('Error:', error);
        addMessage(`Error: ${error.message}`, 'system-message');
        
        // If unauthorized, redirect to login
        if (error.message.includes('401') || error.message.includes('unauthorized')) {
          addMessage('Your session has expired. Please log in again.', 'system-message');
          setTimeout(logout, 3000);
        }
      });
    }
  };

  // Send message when button is clicked
  sendButton.addEventListener('click', sendMessage);

  // Send message when Enter key is pressed
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  function addMessage(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(sender === 'user' ? 'user-message' : 'bot-message');
    messageElement.textContent = text;
    
    chatMessages.appendChild(messageElement);
    
    // Scroll to the bottom of the chat
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Add slide menu functionality
  menuTab.addEventListener('click', () => {
    appContainer.classList.toggle('collapsed');
    
    // Change the icon based on the state
    const icon = menuTab.querySelector('i');
    if (appContainer.classList.contains('collapsed')) {
      icon.classList.remove('fa-chevron-left');
      icon.classList.add('fa-chevron-right');
    } else {
      icon.classList.remove('fa-chevron-right');
      icon.classList.add('fa-chevron-left');
    }
  });
  
  // Add double-click handler to close the menu
  document.addEventListener('dblclick', (event) => {
    // If the menu is open (not collapsed) and not clicking on the menu tab itself
    if (!appContainer.classList.contains('collapsed') && !menuTab.contains(event.target)) {
      // Collapse the menu
      appContainer.classList.add('collapsed');
      
      // Update the icon
      const icon = menuTab.querySelector('i');
      icon.classList.remove('fa-chevron-left');
      icon.classList.add('fa-chevron-right');
      
      console.log('Menu collapsed via double-click');
    }
  });
});
