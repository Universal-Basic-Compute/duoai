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

def prepare_knowledge(output_folder, queries, max_results_per_query=10):
    """Main function to prepare knowledge from YouTube videos."""
    # Set up YouTube API
    youtube = setup_youtube_api()
    
    # Create output directories
    transcripts_dir = os.path.join(output_folder, 'transcripts')
    metadata_dir = os.path.join(output_folder, 'metadata')
    
    os.makedirs(transcripts_dir, exist_ok=True)
    os.makedirs(metadata_dir, exist_ok=True)
    
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
    
    # Process each video to get transcript
    successful_transcripts = 0
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
        else:
            print(f"  ✗ No transcript available")
        
        # Avoid rate limiting
        time.sleep(0.5)
    
    print(f"\nKnowledge preparation complete!")
    print(f"Found {len(unique_videos)} videos")
    print(f"Successfully downloaded {successful_transcripts} transcripts")
    print(f"All data saved to {output_folder}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare knowledge base from YouTube videos.")
    parser.add_argument("output_folder", help="Folder to save the knowledge base")
    parser.add_argument("queries", nargs='+', help="Search queries to find videos")
    parser.add_argument("--max-results", type=int, default=10, help="Maximum results per query (default: 10)")
    
    args = parser.parse_args()
    
    # Ensure the output folder exists
    os.makedirs(args.output_folder, exist_ok=True)
    
    # Run the knowledge preparation
    prepare_knowledge(args.output_folder, args.queries, args.max_results)
