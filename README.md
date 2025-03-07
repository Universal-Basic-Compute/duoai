# DuoAI: Your Intelligent Gaming Companion

DuoAI is an AI-powered gaming assistant that provides real-time advice, strategy optimization, and personalized gaming insights. Using advanced machine learning and computer vision, DuoAI analyzes your gameplay and offers contextual assistance to enhance your gaming experience.

![DuoAI Screenshot](docs/screenshot.png)

## Features

- **Real-time Game Analysis**: DuoAI captures your screen and uses Claude AI to analyze your gameplay in real-time
- **Voice Interaction**: Speak to DuoAI and get voice responses using ElevenLabs' high-quality text-to-speech
- **Multiple AI Personalities**: Choose from 5 different AI characters, each with their own unique approach to helping you
- **Minimal UI**: Unobtrusive interface that stays out of your way while gaming
- **Cross-Platform**: Works on Windows, macOS, and Linux

## AI Characters

- **Nova**: Analytical and supportive, helps you optimize strategies and learn from mistakes
- **Orion**: Motivational coach who pushes your limits and celebrates your achievements
- **Lyra**: Patient teacher who explains complex game mechanics in simple terms
- **Zephyr**: Playful companion who keeps sessions light and entertaining with humor
- **Thorne**: Protective mentor who helps you navigate challenging game situations

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- API keys for:
  - Anthropic Claude API
  - ElevenLabs API
  - OpenAI API (for Whisper speech recognition)
  - Google OAuth (for authentication)

### Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/duoai.git
   cd duoai
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the project root with your API keys:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   SESSION_SECRET=your_session_secret_here
   ```

4. Start the application:
   ```
   npm start
   ```

## Usage

1. Launch DuoAI before or during your gaming session
2. Sign in with your Google account (or use the bypass for testing)
3. Select your preferred AI character from the menu
4. Click "Start" to begin the session
5. DuoAI will analyze your screen and provide advice through text and voice
6. Ask questions or request help by typing or using the microphone button
7. Adjust voice settings using the volume slider and voice selector

## Development

### Project Structure

- `main.js` - Electron main process
- `renderer.js` - Electron renderer process
- `server.js` - Express server for API endpoints
- `claude_api.js` - Interface to Anthropic's Claude API
- `speech.js` - Speech recognition and synthesis functionality
- `screenshot.js` - Screen capture utilities
- `system_prompt_builder.js` - Builds prompts for the AI
- `prompts/` - Contains character-specific prompts
- `styles.css` - Application styling

### Running in Development Mode

```
npm start
```

This will start both the Electron app and the Express server.

### Building for Production

```
npm run build
```

This will create distributable packages for your platform in the `dist/` directory.

## Technologies Used

- **Electron**: Cross-platform desktop application framework
- **Express**: Backend server for API endpoints
- **Anthropic Claude**: AI model for gameplay analysis and advice
- **ElevenLabs**: High-quality text-to-speech
- **OpenAI Whisper**: Speech-to-text recognition
- **Sharp**: Image processing for screenshots

## Roadmap

- [ ] Expanded game-specific knowledge
- [ ] Multiplayer coordination features
- [ ] Performance analytics dashboard
- [ ] Custom AI character creation
- [ ] Mobile companion app

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Anthropic for the Claude AI model
- ElevenLabs for the voice synthesis technology
- OpenAI for the Whisper speech recognition model
- The Electron team for the application framework

## Contact

For questions, feedback, or support, please contact [your-email@example.com](mailto:your-email@example.com)
