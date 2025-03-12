import os
import sys
import argparse
import json
import time
import requests
from pathlib import Path
from googleapiclient.discovery import build
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter
from dotenv import load_dotenv
from time import sleep

# Load environment variables from .env file
load_dotenv()

def setup_youtube_api():
    """Set up and return a YouTube API client."""
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        print("Error: YOUTUBE_API_KEY not found in environment variables.")
        print("Please add your YouTube API key to your .env file.")
        sys.exit(1)
    
    try:
        youtube = build('youtube', 'v3', developerKey=api_key)
        return youtube
    except Exception as e:
        print(f"Error setting up YouTube API: {str(e)}")
        sys.exit(1)

def search_youtube_videos(youtube, query, max_results=10):
    """Search YouTube for videos matching the query."""
    try:
        print(f"Searching YouTube for: '{query}'")
        
        # Execute the search
        search_response = youtube.search().list(
            q=query,
            part='id,snippet',
            maxResults=max_results,
            type='video'
        ).execute()
        
        # Extract video information
        videos = []
        for item in search_response.get('items', []):
            if item['id']['kind'] == 'youtube#video':
                video_id = item['id']['videoId']
                title = item['snippet']['title']
                channel = item['snippet']['channelTitle']
                published_at = item['snippet']['publishedAt']
                
                videos.append({
                    'id': video_id,
                    'title': title,
                    'channel': channel,
                    'published_at': published_at,
                    'url': f"https://www.youtube.com/watch?v={video_id}"
                })
        
        print(f"Found {len(videos)} videos for query: '{query}'")
        return videos
    
    except Exception as e:
        print(f"Error searching YouTube: {str(e)}")
        return []

def get_video_details(youtube, video_ids):
    """Get additional details for a list of videos."""
    if not video_ids:
        return {}
    
    try:
        # Split into chunks of 50 (API limit)
        video_details = {}
        for i in range(0, len(video_ids), 50):
            chunk = video_ids[i:i+50]
            
            # Get video details
            response = youtube.videos().list(
                part='contentDetails,statistics,snippet',
                id=','.join(chunk)
            ).execute()
            
            # Process response
            for item in response.get('items', []):
                video_id = item['id']
                video_details[video_id] = {
                    'duration': item['contentDetails']['duration'],
                    'view_count': item['statistics'].get('viewCount', '0'),
                    'like_count': item['statistics'].get('likeCount', '0'),
                    'comment_count': item['statistics'].get('commentCount', '0'),
                    'description': item['snippet'].get('description', '')
                }
        
        return video_details
    
    except Exception as e:
        print(f"Error getting video details: {str(e)}")
        return {}

def get_video_transcript(video_id):
    """Get transcript for a YouTube video."""
    try:
        # Get transcript from YouTube
        print(f"  Requesting transcript for video {video_id}...")
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        
        # Debug the response
        print(f"  Transcript type: {type(transcript_list)}")
        if isinstance(transcript_list, list) and len(transcript_list) > 0:
            print(f"  First segment: {transcript_list[0]}")
        else:
            print(f"  Transcript content: {transcript_list}")
        
        # Convert the dictionary list to a simple text format manually
        plain_text = "\n".join([segment.get('text', '') for segment in transcript_list])
        
        # Return both formats
        return {
            'text': plain_text,
            'segments': transcript_list
        }
    
    except Exception as e:
        print(f"Error getting transcript for video {video_id}: {str(e)}")
        # Print the full exception traceback for debugging
        import traceback
        traceback.print_exc()
        return None

def sanitize_filename(filename):
    """Sanitize a string to be used as a filename."""
    # Replace invalid characters
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        filename = filename.replace(char, '_')
    
    # Limit length
    if len(filename) > 100:
        filename = filename[:97] + '...'
    
    return filename

def extract_knowledge_with_claude(transcript, api_key):
    """Process transcript with Claude to extract specific knowledge and tips."""
    if not transcript or not api_key:
        return None
    
    # Prepare the request to Claude
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01"
    }
    
    # Create the system prompt and user message
    system_prompt = transcript  # Use transcript as system prompt as requested
    
    user_message = "Make a complete list of specific knowledge/advice/tips about the game based on the transcript."
    
    payload = {
        "model": "claude-3-7-sonnet-20240229",  # Using the model you specified
        "max_tokens": 4000,
        "temperature": 0.2,  # Lower temperature for more focused extraction
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": user_message}
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
                    sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    return None
        except Exception as e:
            print(f"  ✗ Error during Claude API request: {str(e)}")
            if attempt < max_retries - 1:
                print(f"  Retrying in {retry_delay} seconds...")
                sleep(retry_delay)
                retry_delay *= 2
            else:
                return None
    
    return None

def process_existing_transcripts(folder_path, api_key=None):
    """Process existing transcripts in a folder with Claude to extract knowledge."""
    if not api_key:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            print("Error: ANTHROPIC_API_KEY not found in environment variables.")
            return False
    
    # Check if the folder exists
    transcripts_dir = os.path.join(folder_path, 'transcripts')
    if not os.path.exists(transcripts_dir):
        print(f"Error: Transcripts directory not found at {transcripts_dir}")
        return False
    
    # Create knowledge directory if it doesn't exist
    knowledge_dir = os.path.join(folder_path, 'knowledge')
    os.makedirs(knowledge_dir, exist_ok=True)
    
    # Get all transcript text files
    transcript_files = [f for f in os.listdir(transcripts_dir) if f.endswith('.txt')]
    
    if not transcript_files:
        print(f"No transcript files found in {transcripts_dir}")
        return False
    
    print(f"Found {len(transcript_files)} transcript files to process")
    
    # Process each transcript
    successful_extractions = 0
    
    for i, transcript_file in enumerate(transcript_files):
        print(f"Processing transcript {i+1}/{len(transcript_files)}: {transcript_file}")
        
        # Check if knowledge file already exists
        knowledge_filename = transcript_file.replace('.txt', '_knowledge.txt')
        knowledge_path = os.path.join(knowledge_dir, knowledge_filename)
        
        if os.path.exists(knowledge_path):
            print(f"  ✓ Knowledge file already exists at {knowledge_path}, skipping...")
            successful_extractions += 1
            continue
        
        # Read transcript
        transcript_path = os.path.join(transcripts_dir, transcript_file)
        try:
            with open(transcript_path, 'r', encoding='utf-8') as f:
                transcript_text = f.read()
            
            # Extract knowledge using Claude
            print(f"  Extracting knowledge with Claude...")
            knowledge = extract_knowledge_with_claude(transcript_text, api_key)
            
            if knowledge:
                # Save extracted knowledge
                with open(knowledge_path, 'w', encoding='utf-8') as f:
                    f.write(knowledge)
                
                successful_extractions += 1
                print(f"  ✓ Saved extracted knowledge to {knowledge_path}")
            else:
                print(f"  ✗ Failed to extract knowledge")
        
        except Exception as e:
            print(f"  ✗ Error processing transcript {transcript_file}: {str(e)}")
        
        # Avoid rate limiting
        if i < len(transcript_files) - 1:
            print("  Waiting before processing next transcript...")
            time.sleep(2)
    
    print(f"\nKnowledge extraction complete!")
    print(f"Successfully extracted knowledge from {successful_extractions}/{len(transcript_files)} transcripts")
    print(f"All data saved to {knowledge_dir}")
    return True

def prepare_knowledge(output_folder, queries, max_results_per_query=10):
    """Main function to prepare knowledge from YouTube videos."""
    # Set up YouTube API
    youtube = setup_youtube_api()
    
    # Get Anthropic API key
    anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
    if not anthropic_api_key:
        print("Warning: ANTHROPIC_API_KEY not found in environment variables. Will skip knowledge extraction.")
    
    # Create output directories
    transcripts_dir = os.path.join(output_folder, 'transcripts')
    metadata_dir = os.path.join(output_folder, 'metadata')
    knowledge_dir = os.path.join(output_folder, 'knowledge')  # New directory for extracted knowledge
    
    os.makedirs(transcripts_dir, exist_ok=True)
    os.makedirs(metadata_dir, exist_ok=True)
    os.makedirs(knowledge_dir, exist_ok=True)  # Create knowledge directory
    
    # Search for videos matching each query
    all_videos = []
    for query in queries:
        videos = search_youtube_videos(youtube, query, max_results=max_results_per_query)
        all_videos.extend(videos)
        
        # Avoid rate limiting
        time.sleep(1)
    
    # Remove duplicates (same video ID)
    unique_videos = []
    seen_ids = set()
    for video in all_videos:
        if video['id'] not in seen_ids:
            unique_videos.append(video)
            seen_ids.add(video['id'])
    
    print(f"Found {len(unique_videos)} unique videos across all queries")
    
    # Get additional details for all videos
    video_ids = [video['id'] for video in unique_videos]
    video_details = get_video_details(youtube, video_ids)
    
    # Add details to video objects
    for video in unique_videos:
        video_id = video['id']
        if video_id in video_details:
            video.update(video_details[video_id])
    
    # Save all video metadata
    metadata_path = os.path.join(metadata_dir, 'videos.json')
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(unique_videos, f, indent=2)
    
    print(f"Saved metadata for {len(unique_videos)} videos to {metadata_path}")
    
    # Process each video to get transcript and extract knowledge
    successful_transcripts = 0
    successful_knowledge_extractions = 0
    
    for i, video in enumerate(unique_videos):
        video_id = video['id']
        title = video['title']
        
        print(f"Processing video {i+1}/{len(unique_videos)}: {title}")
        
        # Get transcript
        transcript = get_video_transcript(video_id)
        
        if transcript:
            # Create sanitized filename
            filename_base = sanitize_filename(f"{video_id}_{title}")
            
            # Save transcript text
            text_path = os.path.join(transcripts_dir, f"{filename_base}.txt")
            with open(text_path, 'w', encoding='utf-8') as f:
                f.write(transcript['text'])
            
            # Save transcript with timestamps
            json_path = os.path.join(transcripts_dir, f"{filename_base}.json")
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(transcript['segments'], f, indent=2)
            
            successful_transcripts += 1
            print(f"  ✓ Saved transcript to {text_path}")
            
            # Extract knowledge using Claude if API key is available
            if anthropic_api_key:
                print(f"  Extracting knowledge with Claude...")
                knowledge = extract_knowledge_with_claude(transcript['text'], anthropic_api_key)
                
                if knowledge:
                    # Save extracted knowledge
                    knowledge_path = os.path.join(knowledge_dir, f"{filename_base}_knowledge.txt")
                    with open(knowledge_path, 'w', encoding='utf-8') as f:
                        f.write(knowledge)
                    
                    successful_knowledge_extractions += 1
                    print(f"  ✓ Saved extracted knowledge to {knowledge_path}")
                else:
                    print(f"  ✗ Failed to extract knowledge")
            
        else:
            print(f"  ✗ No transcript available")
        
        # Avoid rate limiting
        time.sleep(0.5)
    
    print(f"\nKnowledge preparation complete!")
    print(f"Found {len(unique_videos)} videos")
    print(f"Successfully downloaded {successful_transcripts} transcripts")
    print(f"Successfully extracted knowledge from {successful_knowledge_extractions} transcripts")
    print(f"All data saved to {output_folder}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare knowledge base from YouTube videos or process existing transcripts.")
    
    # Create subparsers for different modes
    subparsers = parser.add_subparsers(dest='mode', help='Operation mode')
    
    # Parser for YouTube search mode
    youtube_parser = subparsers.add_parser('youtube', help='Search YouTube and download transcripts')
    youtube_parser.add_argument("output_folder", help="Folder to save the knowledge base")
    youtube_parser.add_argument("queries", nargs='+', help="Search queries to find videos")
    youtube_parser.add_argument("--max-results", type=int, default=10, help="Maximum results per query (default: 10)")
    
    # Parser for processing existing transcripts
    process_parser = subparsers.add_parser('process', help='Process existing transcripts with Claude')
    process_parser.add_argument("folder_path", help="Path to the folder containing transcripts")
    
    args = parser.parse_args()
    
    # Handle different modes
    if args.mode == 'youtube':
        # Ensure the output folder exists
        os.makedirs(args.output_folder, exist_ok=True)
        
        # Run the knowledge preparation
        prepare_knowledge(args.output_folder, args.queries, args.max_results)
    
    elif args.mode == 'process':
        # Process existing transcripts
        process_existing_transcripts(args.folder_path)
    
    else:
        # If no mode specified, show help
        parser.print_help()
