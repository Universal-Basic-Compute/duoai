import os
import sys
import json
import argparse
import subprocess
import requests
import time
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def get_video_duration(video_path, timeout=30):
    """Get the duration of a video file using ffprobe with timeout."""
    cmd = [
        'ffprobe', 
        '-v', 'error', 
        '-show_entries', 'format=duration', 
        '-of', 'default=noprint_wrappers=1:nokey=1', 
        video_path
    ]
    
    try:
        print(f"Running FFprobe command: {' '.join(cmd)}")
        result = subprocess.run(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            text=True,
            timeout=timeout  # Add timeout
        )
        
        if result.returncode != 0:
            print(f"Error getting video duration: {result.stderr}")
            sys.exit(1)
        return float(result.stdout.strip())
    except subprocess.TimeoutExpired:
        print(f"FFprobe timed out after {timeout} seconds")
        sys.exit(1)
    except Exception as e:
        print(f"Exception during video duration check: {str(e)}")
        sys.exit(1)

def create_output_directory(video_path, base_dir="website/videos"):
    """Create output directory for the processed video."""
    video_filename = Path(video_path).stem
    output_dir = os.path.join(base_dir, f"{video_filename}-prepared")
    os.makedirs(output_dir, exist_ok=True)
    return output_dir, video_filename

def extract_frame(video_path, output_path, time_position, timeout=30):
    """Extract a single frame at the specified time position with timeout."""
    cmd = [
        'ffmpeg',
        '-ss', str(time_position),
        '-i', video_path,
        '-vframes', '1',
        '-q:v', '2',
        '-y',  # Overwrite output files without asking
        output_path
    ]
    
    try:
        # Use subprocess with timeout
        print(f"  Running FFmpeg command: {' '.join(cmd)}")
        result = subprocess.run(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            timeout=timeout  # Add timeout
        )
        
        if result.returncode != 0:
            print(f"  ✗ Error extracting frame at {time_position}s: {result.stderr.decode()}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print(f"  ✗ FFmpeg frame extraction timed out after {timeout} seconds")
        return False
    except Exception as e:
        print(f"  ✗ Exception during frame extraction: {str(e)}")
        return False

def extract_audio_segment(video_path, output_path, start_time, duration=30, timeout=30):
    """Extract an audio segment starting at the specified time with timeout."""
    cmd = [
        'ffmpeg',
        '-ss', str(start_time),
        '-t', str(duration),
        '-i', video_path,
        '-q:a', '0',
        '-map', 'a',
        '-y',  # Overwrite output files without asking
        output_path
    ]
    
    try:
        # Use subprocess with timeout
        print(f"  Running FFmpeg command: {' '.join(cmd)}")
        result = subprocess.run(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            timeout=timeout  # Add timeout
        )
        
        if result.returncode != 0:
            print(f"  ✗ Error extracting audio at {start_time}s: {result.stderr.decode()}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print(f"  ✗ FFmpeg audio extraction timed out after {timeout} seconds")
        return False
    except Exception as e:
        print(f"  ✗ Exception during audio extraction: {str(e)}")
        return False

def transcribe_audio(audio_path, language="en", timeout_seconds=60):
    """Transcribe audio using ElevenLabs API with timeout protection."""
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        print("Warning: ELEVENLABS_API_KEY not found in environment variables. Skipping transcription.")
        return None
    
    # Platform-independent timeout handling
    file_handle = None
    try:
        print(f"  Opening audio file: {audio_path}")
        file_handle = open(audio_path, 'rb')
        
        # Prepare request with multipart form data
        url = "https://api.elevenlabs.io/v1/speech-to-text"
        headers = {
            "xi-api-key": api_key
        }
        
        # Create multipart form data
        files = {
            'file': (os.path.basename(audio_path), file_handle, 'audio/mpeg')
        }
        
        data = {
            'model_id': 'scribe_v1',  # Required parameter
            'language_code': language if language else None,
            'tag_audio_events': 'true',
            'timestamps_granularity': 'word'
        }
        
        # Make API request with retry logic
        max_retries = 3
        retry_delay = 2  # seconds
        
        for attempt in range(max_retries):
            try:
                print(f"  Transcribing audio... (attempt {attempt+1}/{max_retries})")
                
                # Use a shorter timeout for the request itself
                response = requests.post(
                    url, 
                    headers=headers, 
                    files=files, 
                    data=data, 
                    timeout=timeout_seconds  # Use the full timeout for the request
                )
                
                print(f"  Received response with status code: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get("text", "")
                else:
                    print(f"  ✗ Transcription failed: {response.status_code} - {response.text}")
                    if attempt < max_retries - 1:
                        print(f"  Retrying in {retry_delay} seconds...")
                        time.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                    else:
                        return None
            except requests.exceptions.RequestException as e:
                print(f"  ✗ Connection error during transcription: {str(e)}")
                if attempt < max_retries - 1:
                    print(f"  Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    return None
    except Exception as e:
        print(f"  ✗ Error during transcription: {str(e)}")
        return None
    finally:
        # Close the file handle if it was opened
        if file_handle is not None:
            try:
                file_handle.close()
                print("  File handle closed")
            except:
                pass

def prepare_video(video_path, base_dir="website/videos", language="en", 
                 skip_transcription=False, start_segment=0, end_segment=None):
    """Process a video file, extracting frames and audio segments every 30 seconds."""
    if not os.path.exists(video_path):
        print(f"Error: Video file '{video_path}' not found.")
        return False
    
    # Get video duration
    duration = get_video_duration(video_path)
    print(f"Video duration: {duration:.2f} seconds")
    
    # Create output directory
    output_dir, video_filename = create_output_directory(video_path, base_dir)
    print(f"Output directory: {output_dir}")
    
    # Calculate number of segments
    segment_duration = 30
    num_segments = int(duration // segment_duration)
    print(f"Total segments: {num_segments}")
    
    # Adjust segment range based on parameters
    if end_segment is None or end_segment > num_segments:
        end_segment = num_segments
    
    print(f"Processing segments {start_segment} to {end_segment-1}...")
    
    # Load existing metadata if available
    existing_segments = []
    metadata_path = os.path.join(output_dir, "metadata.json")
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, 'r') as f:
                existing_metadata = json.load(f)
                existing_segments = existing_metadata.get("segments", [])
                print(f"Loaded {len(existing_segments)} existing segments from metadata")
        except Exception as e:
            print(f"Error loading existing metadata: {str(e)}")
    
    # Process each segment
    segments = existing_segments.copy()
    for i in range(start_segment, end_segment):
        start_time = i * segment_duration
        print(f"Processing segment {i+1}/{end_segment} (starting at {start_time}s)...")
        
        # Check if segment already exists in metadata
        existing_segment = next((s for s in existing_segments if s["segment"] == i), None)
        if existing_segment:
            print(f"  Segment {i} already exists in metadata, skipping...")
            continue
        
        try:
            # Extract frame
            print(f"  Extracting frame at {start_time}s...")
            frame_path = os.path.join(output_dir, f"frame_{i}.jpg")
            frame_success = extract_frame(video_path, frame_path, start_time)
            if frame_success:
                print(f"  ✓ Extracted frame to {frame_path}")
            else:
                print(f"  ✗ Failed to extract frame")
            
            # Extract audio
            print(f"  Extracting audio segment at {start_time}s...")
            audio_path = os.path.join(output_dir, f"audio_{i}.mp3")
            audio_success = extract_audio_segment(video_path, audio_path, start_time, segment_duration)
            if audio_success:
                print(f"  ✓ Extracted audio to {audio_path}")
            else:
                print(f"  ✗ Failed to extract audio")
                continue
            
            # Transcribe audio (with timeout) if not skipped
            transcript = None
            if not skip_transcription and os.path.exists(audio_path) and os.path.getsize(audio_path) > 0:
                transcript = transcribe_audio(audio_path, language, timeout_seconds=60)
            else:
                if skip_transcription:
                    print(f"  ℹ Transcription skipped as requested")
                else:
                    print(f"  ✗ Audio file is empty or missing, skipping transcription")
            
            transcript_path = os.path.join(output_dir, f"transcript_{i}.txt")
            
            if transcript:
                # Save transcript to file
                with open(transcript_path, 'w', encoding='utf-8') as f:
                    f.write(transcript)
                print(f"  ✓ Created transcript: {transcript_path}")
            else:
                print(f"  ✗ No transcript generated")
                transcript_path = None
            
            # Add segment info
            segment_info = {
                "segment": i,
                "startTime": start_time,
                "frameFile": f"frame_{i}.jpg",
                "audioFile": f"audio_{i}.mp3"
            }
            
            # Add transcript info if available
            if transcript:
                segment_info["transcriptFile"] = f"transcript_{i}.txt"
                segment_info["transcript"] = transcript
            
            segments.append(segment_info)
            
            # Save metadata after each segment (in case of crash)
            temp_metadata = {
                "originalVideo": video_filename,
                "totalDuration": duration,
                "segmentCount": num_segments,
                "segments": segments,
                "lastProcessedSegment": i
            }
            
            temp_metadata_path = os.path.join(output_dir, "metadata_temp.json")
            with open(temp_metadata_path, 'w') as f:
                json.dump(temp_metadata, f, indent=2)
                
        except Exception as e:
            print(f"  ✗ Error processing segment {i}: {str(e)}")
            # Continue with next segment
    
    # Create final metadata file
    metadata = {
        "originalVideo": video_filename,
        "totalDuration": duration,
        "segmentCount": num_segments,
        "segments": segments
    }
    
    metadata_path = os.path.join(output_dir, "metadata.json")
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    # Remove temporary metadata file if it exists
    temp_metadata_path = os.path.join(output_dir, "metadata_temp.json")
    if os.path.exists(temp_metadata_path):
        try:
            os.remove(temp_metadata_path)
        except:
            pass
    
    print(f"\nProcessing complete! Metadata saved to {metadata_path}")
    print(f"Created {len(segments)} segments in {output_dir}")
    return True

def check_ffmpeg():
    """Check if FFmpeg is installed and working."""
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'], 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            timeout=5
        )
        if result.returncode == 0:
            print("FFmpeg is installed and working.")
            return True
        else:
            print("FFmpeg seems to be installed but not working properly.")
            return False
    except subprocess.TimeoutExpired:
        print("FFmpeg check timed out.")
        return False
    except FileNotFoundError:
        print("FFmpeg is not installed or not in the PATH.")
        return False
    except Exception as e:
        print(f"Error checking FFmpeg: {str(e)}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process a video file, extracting frames and audio segments every 30 seconds.")
    parser.add_argument("video_path", help="Path to the video file to process")
    parser.add_argument("--output-dir", default="website/videos", help="Base directory for output (default: website/videos)")
    parser.add_argument("--language", default="en", help="Language code for transcription (default: en)")
    parser.add_argument("--skip-transcription", action="store_true", help="Skip the transcription step")
    parser.add_argument("--start-segment", type=int, default=0, help="Start processing from this segment number")
    parser.add_argument("--end-segment", type=int, default=None, help="Stop processing at this segment number")
    
    args = parser.parse_args()
    
    # Check if FFmpeg is installed
    if not check_ffmpeg():
        print("Please install FFmpeg and make sure it's in your PATH.")
        sys.exit(1)
    
    # Ensure the base output directory exists
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Process the video
    prepare_video(
        args.video_path, 
        args.output_dir, 
        args.language, 
        skip_transcription=args.skip_transcription,
        start_segment=args.start_segment,
        end_segment=args.end_segment
    )
