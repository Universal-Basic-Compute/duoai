import { useState } from 'react';

export default function ApiTest() {
  const [text, setText] = useState('Hello, this is a test for text to speech conversion.');
  const [audioUrl, setAudioUrl] = useState('');
  const [transcription, setTranscription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Test TTS API
  const testTTS = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
    } catch (err) {
      setError(`TTS Error: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Test STT API (would need audio recording functionality for complete test)
  const testSTT = async (audioFile) => {
    if (!audioFile) {
      setError('Please select an audio file');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioFile);
      reader.onload = async () => {
        // Extract base64 data
        const base64Audio = reader.result.split(',')[1];
        
        const response = await fetch('/api/stt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ audio: base64Audio }),
        });
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const data = await response.json();
        setTranscription(data.text);
        setIsLoading(false);
      };
    } catch (err) {
      setError(`STT Error: ${err.message}`);
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>API Test Page</h1>
      
      <div style={{ marginBottom: '40px' }}>
        <h2>Test Text-to-Speech</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ width: '100%', height: '100px', marginBottom: '10px' }}
        />
        <button 
          onClick={testTTS} 
          disabled={isLoading}
          style={{ padding: '8px 16px' }}
        >
          {isLoading ? 'Converting...' : 'Convert to Speech'}
        </button>
        
        {audioUrl && (
          <div style={{ marginTop: '20px' }}>
            <audio controls src={audioUrl} style={{ width: '100%' }} />
          </div>
        )}
      </div>
      
      <div>
        <h2>Test Speech-to-Text</h2>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => e.target.files[0] && testSTT(e.target.files[0])}
          style={{ marginBottom: '10px' }}
        />
        
        {transcription && (
          <div style={{ marginTop: '20px' }}>
            <h3>Transcription:</h3>
            <p>{transcription}</p>
          </div>
        )}
      </div>
      
      {error && (
        <div style={{ color: 'red', marginTop: '20px' }}>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
