import os
import sys
import argparse
import json
import base64
import time
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def generate_speech_from_advice(advice_text, output_path, api_key, voice_id="pNInz6obpgDQGcFmaJgB"):
    """Generate speech from advice text using ElevenLabs API."""
    if not advice_text or not api_key:
        print("  ✗ Missing advice text or API key for speech generation")
        return False
    
    # Prepare the request to ElevenLabs
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "Content-Type": "application/json",
        "xi-api-key": api_key
    }
    
    # Prepare the payload
    payload = {
        "text": advice_text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.5
        }
    }
    
    # Make the API request with retry logic
    max_retries = 3
    retry_delay = 5  # seconds
    
    for attempt in range(max_retries):
        try:
            print(f"  Generating speech... (attempt {attempt+1}/{max_retries})")
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            
            if response.status_code == 200:
                # Save the audio file
                with open(output_path, 'wb') as f:
                    f.write(response.content)
                print(f"  ✓ Saved speech to {output_path}")
                return True
            else:
                print(f"  ✗ Speech generation failed: {response.status_code} - {response.text}")
                if attempt < max_retries - 1:
                    print(f"  Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    return False
        except Exception as e:
            print(f"  ✗ Error during speech generation: {str(e)}")
            if attempt < max_retries - 1:
                print(f"  Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2
            else:
                return False
    
    return False

def encode_image_to_base64(image_path):
    """Encode an image file to base64."""
    try:
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        print(f"Error encoding image {image_path}: {str(e)}")
        return None

def load_knowledge_files(knowledge_dir):
    """Load all knowledge files from the knowledge directory."""
    if not os.path.exists(knowledge_dir):
        print(f"Knowledge directory not found: {knowledge_dir}")
        return ""
    
    knowledge_files = [f for f in os.listdir(knowledge_dir) if f.endswith('.txt')]
    if not knowledge_files:
        print(f"No knowledge files found in {knowledge_dir}")
        return ""
    
    print(f"Loading {len(knowledge_files)} knowledge files...")
    
    combined_knowledge = ""
    for filename in knowledge_files:
        file_path = os.path.join(knowledge_dir, filename)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                combined_knowledge += f"\n\n--- KNOWLEDGE FROM {filename} ---\n{content}\n"
        except Exception as e:
            print(f"Error reading knowledge file {filename}: {str(e)}")
    
    print(f"Loaded {len(combined_knowledge)} characters of knowledge")
    return combined_knowledge

def generate_advice_with_claude_and_context(image_path, transcript_text, knowledge_text, previous_advices, api_key):
    """Generate advice using Claude based on image, transcript, knowledge, and previous advices."""
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not found in environment variables.")
        return None
    
    # Encode image to base64
    image_base64 = encode_image_to_base64(image_path)
    if not image_base64:
        print("Failed to encode image, proceeding with text only")
    
    # Prepare the request to Claude
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01"
    }
    
    # Format previous advices as a string
    previous_advices_text = ""
    if previous_advices:
        previous_advices_text = "Previous advices:\n" + "\n".join(previous_advices)
    
    # Create system prompt with knowledge
    system_prompt = f"""You are an expert gaming advisor who provides specific, actionable advice to players based on their current game situation.
Use the knowledge provided below to inform your advice.

{knowledge_text}

Analyze the game screenshot and transcript carefully. Then provide specific advice that will help the player in their current situation.

Your advice must:
1. Address the player directly using "you" language
2. Be specific to what's visible in the screenshot and mentioned in the transcript, if relevant
3. Do not repeat previously shared advice
4. Be actionable - tell the player exactly what they should do
5. Be strategic - explain why this is the best course of action
6. Be concise - focus on the most important piece of advice

Format your response as a short paragraph or a few sentences. Do not use bullet points.

IMPORTANT: Respond ONLY with the advice itself. Do not include any introductions, explanations about what you're doing, or conclusions. Start directly with your advice in sentence form."""
    
    # Create messages array with previous advices and current request
    messages = []
    
    # Add previous advices as a single assistant message if available
    if previous_advices:
        messages.append({
            "role": "assistant",
            "content": previous_advices_text
        })
    
    # Add the current user message with transcript and image
    if image_base64:
        # Include image in the message
        user_content = [
            {
                "type": "text",
                "text": f"Here's a screenshot from my game and the transcript of what's happening. Give me specific advice for what I should do in this situation:\n\nTRANSCRIPT:\n{transcript_text}"
            },
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": image_base64
                }
            }
        ]
    else:
        # Text-only message
        user_content = f"Here's a screenshot from my game and the transcript of what's happening. Give me specific advice for what I should do in this situation:\n\nTRANSCRIPT:\n{transcript_text}"
    
    messages.append({
        "role": "user",
        "content": user_content
    })
    
    # Prepare the payload
    payload = {
        "model": "claude-3-5-haiku-latest",
        "max_tokens": 1000,
        "temperature": 0.2,
        "system": system_prompt,
        "messages": messages
    }
    
    # Make the API request with retry logic
    max_retries = 3
    retry_delay = 5  # seconds
    
    for attempt in range(max_retries):
        try:
            print(f"  Making Claude API request (attempt {attempt+1}/{max_retries})...")
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            
            if response.status_code == 200:
                result = response.json()
                # Extract the text content from the response
                content = result.get("content", [])
                if isinstance(content, list) and len(content) > 0:
                    # Handle the Claude API response format
                    text_blocks = [block.get("text", "") for block in content if block.get("type") == "text"]
                    return "\n".join(text_blocks)
                return "No text content found in response"
            else:
                print(f"  ✗ Claude API request failed: {response.status_code} - {response.text}")
                if attempt < max_retries - 1:
                    print(f"  Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    return None
        except Exception as e:
            print(f"  ✗ Error during Claude API request: {str(e)}")
            if attempt < max_retries - 1:
                print(f"  Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2
            else:
                return None
    
    return None

def generate_advice_with_claude(image_path, transcript_text, knowledge_text, api_key):
    """Generate advice using Claude based on image, transcript, and knowledge."""
    # For backward compatibility, call the new function with empty previous_advices
    return generate_advice_with_claude_and_context(image_path, transcript_text, knowledge_text, [], api_key)

def process_segments(knowledge_dir, transcript_dir, generate_speech=False, voice_id="pNInz6obpgDQGcFmaJgB"):
    """Process all segments in the transcript directory."""
    # Get API key
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not found in environment variables.")
        return False
    
    # Get ElevenLabs API key if speech generation is enabled
    elevenlabs_api_key = None
    if generate_speech:
        elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
        if not elevenlabs_api_key:
            print("Warning: ELEVENLABS_API_KEY not found in environment variables. Speech generation will be skipped.")
            generate_speech = False
    
    # Load knowledge files
    knowledge_text = load_knowledge_files(knowledge_dir)
    
    # Find all metadata.json files in the transcript directory
    metadata_files = []
    for root, dirs, files in os.walk(transcript_dir):
        if "metadata.json" in files:
            metadata_files.append(os.path.join(root, "metadata.json"))
    
    if not metadata_files:
        print(f"No metadata.json files found in {transcript_dir}")
        return False
    
    print(f"Found {len(metadata_files)} metadata files to process")
    
    # Process each metadata file
    for metadata_path in metadata_files:
        folder_path = os.path.dirname(metadata_path)
        folder_name = os.path.basename(folder_path)
        
        print(f"\nProcessing folder: {folder_name}")
        
        try:
            # Load metadata
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            segments = metadata.get("segments", [])
            print(f"Found {len(segments)} segments in metadata")
            
            # Keep track of the last 10 advices
            last_advices = []
            
            # Process each segment
            for segment in segments:
                segment_num = segment.get("segment")
                transcript = segment.get("transcript")
                frame_file = segment.get("frameFile")
                
                if not transcript or not frame_file:
                    print(f"  Skipping segment {segment_num}: Missing transcript or frame file")
                    continue
                
                # Check if advice file already exists
                advice_file = f"advice_{segment_num}.txt"
                advice_path = os.path.join(folder_path, advice_file)
                
                # Check if speech file already exists
                speech_file = f"advice_{segment_num}.mp3"
                speech_path = os.path.join(folder_path, speech_file)
                
                # Load existing advice for context if it exists
                if os.path.exists(advice_path):
                    print(f"  Advice for segment {segment_num} already exists, loading for context...")
                    try:
                        with open(advice_path, 'r', encoding='utf-8') as f:
                            existing_advice = f.read().strip()
                            # Add to last advices with segment number
                            last_advices.append(f"Segment {segment_num}: {existing_advice}")
                            # Keep only the last 10
                            if len(last_advices) > 10:
                                last_advices.pop(0)
                            
                            # Generate speech if needed and not already exists
                            if generate_speech and elevenlabs_api_key and not os.path.exists(speech_path):
                                print(f"  Generating speech for existing advice...")
                                generate_speech_from_advice(
                                    existing_advice, 
                                    speech_path, 
                                    elevenlabs_api_key,
                                    voice_id
                                )
                                
                                # Update metadata with speech file
                                segment["speechFile"] = speech_file
                    except Exception as e:
                        print(f"  Error loading existing advice: {str(e)}")
                    
                    # Skip to next segment if we're not generating speech or speech already exists
                    if not generate_speech or os.path.exists(speech_path):
                        continue
                
                # If we need to generate new advice
                if not os.path.exists(advice_path):
                    print(f"  Processing segment {segment_num}...")
                    
                    # Get paths
                    frame_path = os.path.join(folder_path, frame_file)
                    
                    # Generate advice with context from previous advices
                    advice = generate_advice_with_claude_and_context(
                        frame_path, 
                        transcript, 
                        knowledge_text, 
                        last_advices,
                        api_key
                    )
                    
                    if advice:
                        # Save advice
                        with open(advice_path, 'w', encoding='utf-8') as f:
                            f.write(advice)
                        
                        # Update metadata
                        segment["adviceFile"] = advice_file
                        segment["advice"] = advice
                        
                        # Add to last advices
                        last_advices.append(f"Segment {segment_num}: {advice}")
                        # Keep only the last 10
                        if len(last_advices) > 10:
                            last_advices.pop(0)
                        
                        print(f"  ✓ Saved advice to {advice_path}")
                        
                        # Generate speech if enabled
                        if generate_speech and elevenlabs_api_key:
                            speech_success = generate_speech_from_advice(
                                advice, 
                                speech_path, 
                                elevenlabs_api_key,
                                voice_id
                            )
                            
                            if speech_success:
                                # Update metadata with speech file
                                segment["speechFile"] = speech_file
                    else:
                        print(f"  ✗ Failed to generate advice for segment {segment_num}")
                
                # Wait before processing next segment to avoid rate limiting
                time.sleep(2)
            
            # Save updated metadata
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2)
            
            print(f"Updated metadata saved to {metadata_path}")
            
        except Exception as e:
            print(f"Error processing metadata file {metadata_path}: {str(e)}")
    
    print("\nAdvice generation complete!")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate game advice based on screenshots and transcripts.")
    parser.add_argument("knowledge_dir", help="Directory containing knowledge files")
    parser.add_argument("transcript_dir", help="Directory containing transcript files and metadata")
    parser.add_argument("--generate-speech", action="store_true", help="Generate speech for each advice using ElevenLabs")
    parser.add_argument("--voice-id", default="pNInz6obpgDQGcFmaJgB", help="ElevenLabs voice ID to use (default: pNInz6obpgDQGcFmaJgB)")
    
    args = parser.parse_args()
    
    # Process segments
    process_segments(
        args.knowledge_dir, 
        args.transcript_dir, 
        generate_speech=args.generate_speech,
        voice_id=args.voice_id
    )
