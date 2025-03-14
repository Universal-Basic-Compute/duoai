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

// Function to fetch messages from the API
async function fetchMessages(username = 'anonymous', character = 'Zephyr', count = 20) {
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
    
    const response = await fetch(`${apiUrl}?username=${encodeURIComponent(username)}&character=${encodeURIComponent(character)}&count=${count}`);
    
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

// Function to handle microphone recording and STT
async function setupMicrophoneRecording() {
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
    
    // Function to detect silence in audio
    async function detectSilence(audioBlob, silenceThreshold = 0.01) {
      return new Promise((resolve) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const fileReader = new FileReader();
        
        fileReader.onload = function() {
          const arrayBuffer = this.result;
          
          audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
            const channelData = audioBuffer.getChannelData(0); // Get data from first channel
            
            // Calculate RMS (root mean square) to determine audio level
            let sum = 0;
            for (let i = 0; i < channelData.length; i++) {
              sum += channelData[i] * channelData[i];
            }
            const rms = Math.sqrt(sum / channelData.length);
            
            console.log('Audio RMS level:', rms);
            
            // If RMS is below threshold, consider it silence
            const isSilence = rms < silenceThreshold;
            resolve(isSilence);
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
      // Create audio blob from chunks
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];
      
      // Check if the audio is mostly silence
      const isSilence = await detectSilence(audioBlob);
      
      if (isSilence) {
        console.log('Detected silence, skipping transcription');
        return;
      }
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result.split(',')[1];
        
        try {
          // Call speech-to-text API
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
        }
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

// Function to start continuous recording
function startContinuousRecording() {
  if (!mediaRecorder) {
    console.error('Media recorder not initialized');
    return;
  }

  try {
    // Start recording immediately
    audioChunks = [];
    if (mediaRecorder.state !== 'recording') {
      mediaRecorder.start();
      isRecording = true;
      console.log('Started continuous recording');
    } else {
      console.log('Recorder is already recording');
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
      
      if (isRecording && mediaRecorder.state === 'recording') {
        // Stop current recording
        mediaRecorder.stop();
        isRecording = false;
        console.log('Stopped recording for processing');
        
        // Start a new recording after a short delay
        setTimeout(() => {
          if (mediaRecorder.state !== 'recording') {
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
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const chatMessages = document.getElementById('chat-messages');
  
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
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio: audioBase64 }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error('Error calling STT API:', error);
      throw error;
    }
  }

  // Send message when button is clicked
  sendButton.addEventListener('click', sendMessage);

  // Send message when Enter key is pressed
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  async function sendMessage() {
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
          username: 'anonymous', // Replace with actual username if available
          character: 'Zephyr',   // Replace with selected character if available
          screenshot: screenshot // Include the screenshot if available
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
      });
    }
  }

  function addMessage(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(sender === 'user' ? 'user-message' : 'bot-message');
    messageElement.textContent = text;
    
    chatMessages.appendChild(messageElement);
    
    // Scroll to the bottom of the chat
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

});
