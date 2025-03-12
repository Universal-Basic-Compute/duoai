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

def generate_advice_with_claude(image_path, transcript_text, knowledge_text, api_key):
    """Generate advice using Claude based on image, transcript, and knowledge."""
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
    
    # Create system prompt with knowledge
    system_prompt = f"""You are an expert gaming advisor who provides specific, actionable advice to players based on their current game situation.
Use the knowledge provided below to inform your advice.

{knowledge_text}

Analyze the game screenshot and transcript carefully. Then provide specific advice that will help the player in their current situation.

Your advice must:
1. Address the player directly using "you" language
2. Be specific to what's visible in the screenshot and mentioned in the transcript
3. Be actionable - tell the player exactly what they should do
4. Be strategic - explain why this is the best course of action
5. Be concise - focus on the most important piece of advice

Format your response as a short paragraph or a few sentences. Do not use bullet points.

IMPORTANT: Respond ONLY with the advice itself. Do not include any introductions, explanations about what you're doing, or conclusions. Start directly with your advice in sentence form."""
    
    # Create user message with transcript
    user_message = f"Here's a screenshot from my game and the transcript of what's happening. Give me specific advice for what I should do in this situation:\n\nTRANSCRIPT:\n{transcript_text}"
    
    # Prepare the payload
    if image_base64:
        # Include image in the message
        payload = {
            "model": "claude-3-5-haiku-latest",
            "max_tokens": 1000,
            "temperature": 0.2,
            "system": system_prompt,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": user_message
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
                }
            ]
        }
    else:
        # Text-only message
        payload = {
            "model": "claude-3-5-haiku-latest",
            "max_tokens": 1000,
            "temperature": 0.2,
            "system": system_prompt,
            "messages": [
                {
                    "role": "user",
                    "content": user_message
                }
            ]
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

def process_segments(knowledge_dir, transcript_dir):
    """Process all segments in the transcript directory."""
    # Get API key
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not found in environment variables.")
        return False
    
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
                
                if os.path.exists(advice_path):
                    print(f"  Advice for segment {segment_num} already exists, skipping...")
                    continue
                
                print(f"  Processing segment {segment_num}...")
                
                # Get paths
                frame_path = os.path.join(folder_path, frame_file)
                
                # Generate advice
                advice = generate_advice_with_claude(frame_path, transcript, knowledge_text, api_key)
                
                if advice:
                    # Save advice
                    with open(advice_path, 'w', encoding='utf-8') as f:
                        f.write(advice)
                    
                    # Update metadata
                    segment["adviceFile"] = advice_file
                    segment["advice"] = advice
                    
                    print(f"  ✓ Saved advice to {advice_path}")
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
    
    args = parser.parse_args()
    
    # Process segments
    process_segments(args.knowledge_dir, args.transcript_dir)
