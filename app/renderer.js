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
      
      // Call the LLM API
      callLLMApi(message)
        .then(botResponse => {
          // Remove loading indicator
          chatMessages.removeChild(loadingElement);
          
          // Add bot response to chat
          addMessage(botResponse, 'bot');
          
          // Convert bot response to speech
          return textToSpeech(botResponse);
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
          addMessage('Sorry, I encountered an error. Please try again.', 'bot');
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

  // Function to call the LLM API
  async function callLLMApi(message) {
    try {
      // Use different URLs based on environment
      let apiUrl;
      if (isElectron()) {
        // When running in Electron, use the full URL to the production API
        apiUrl = 'https://duogaming.ai/api/utils/llm';
      } else {
        // When running in a browser, use a relative URL
        apiUrl = '/api/utils/llm';
      }
      
      // Log the URL being used
      console.log('Calling LLM API at:', apiUrl);
      
      // Prepare messages array with conversation history
      const messages = [
        {
          role: 'system',
          content: 'You are a helpful, friendly AI assistant. Provide concise and helpful responses.'
        }
      ];
      
      // Add conversation history
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
      
      // Add the new user message
      messages.push({
        role: 'user',
        content: message
      });
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle the Anthropic API response format
      if (data.content && Array.isArray(data.content) && data.content.length > 0) {
        const botResponse = data.content[0].text;
        
        // Update conversation history with the new messages
        conversationHistory.push({ role: 'user', content: message });
        conversationHistory.push({ role: 'assistant', content: botResponse });
        
        return botResponse;
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        return "I'm sorry, I couldn't generate a response at this time.";
      }
    } catch (error) {
      console.error('Error calling LLM API:', error);
      throw error;
    }
  }
});
