document.addEventListener('DOMContentLoaded', () => {
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const chatMessages = document.getElementById('chat-messages');

  // Add a welcome message
  addMessage('Hello! How can I help you today?', 'bot');
  
  // Text-to-speech function using ElevenLabs API
  async function textToSpeech(text, voiceId) {
    try {
      // Use the correct domain for API endpoints
      const apiBaseUrl = window.location.origin || 'https://duoai.vercel.app';
        
      const response = await fetch(`${apiBaseUrl}/api/tts`, {
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
      // Use the correct domain for API endpoints
      const apiBaseUrl = window.location.origin || 'https://duoai.vercel.app';
        
      const response = await fetch(`${apiBaseUrl}/api/stt`, {
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

  // Add this new function to call the LLM API
  async function callLLMApi(message) {
    try {
      const apiBaseUrl = window.location.origin || 'https://duoai.vercel.app';
      
      const response = await fetch(`${apiBaseUrl}/api/llm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a helpful, friendly AI assistant. Provide concise and helpful responses.'
            },
            {
              role: 'user',
              content: message
            }
          ]
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle the Anthropic API response format
      if (data.content && Array.isArray(data.content) && data.content.length > 0) {
        return data.content[0].text;
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
