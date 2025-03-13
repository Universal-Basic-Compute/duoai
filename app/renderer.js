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

  function sendMessage() {
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
          character: 'Zephyr'    // Replace with selected character if available
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
        
        // Convert bot response to speech
        return textToSpeech(data.response);
      })
      .then(audioUrl => {
        const audio = new Audio(audioUrl);
        audio.play();
      })
      .catch(error => {
        // Remove loading indicator
        if (loadingElement.parentNode) {
          chatMessages.removeChild(loadingElement);
        }
        
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
