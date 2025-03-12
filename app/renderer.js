document.addEventListener('DOMContentLoaded', () => {
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const chatMessages = document.getElementById('chat-messages');

  // Add a welcome message
  addMessage('Hello! How can I help you today?', 'bot');
  
  // Text-to-speech function using ElevenLabs API
  async function textToSpeech(text, voiceId) {
    try {
      // Use the new domain for API endpoints
      const apiBaseUrl = 'https://duogaming.ai';
        
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
      // Use the new domain for API endpoints
      const apiBaseUrl = 'https://duogaming.ai';
        
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
      
      // Simulate bot response after a short delay
      setTimeout(async () => {
        const botResponse = getBotResponse(message);
        addMessage(botResponse, 'bot');
        
        // Optional: Convert bot response to speech
        try {
          const audioUrl = await textToSpeech(botResponse);
          const audio = new Audio(audioUrl);
          audio.play();
        } catch (error) {
          console.error('Failed to play audio:', error);
        }
      }, 1000);
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

  function getBotResponse(message) {
    // Simple response logic - you can expand this
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return 'Hello there! How can I help you?';
    } else if (lowerMessage.includes('how are you')) {
      return 'I\'m just a computer program, but I\'m functioning well. Thanks for asking!';
    } else if (lowerMessage.includes('bye')) {
      return 'Goodbye! Have a great day!';
    } else if (lowerMessage.includes('name')) {
      return 'I\'m your friendly chat assistant.';
    } else if (lowerMessage.includes('help')) {
      return 'I can chat with you about various topics. Just type a message and I\'ll respond!';
    } else {
      return 'That\'s interesting! Tell me more or ask me something else.';
    }
  }
});
