import os
import sys
import json
import argparse
import subprocess
from pathlib import Path

def get_video_duration(video_path):
    """Get the duration of a video file using ffprobe."""
    cmd = [
        'ffprobe', 
        '-v', 'error', 
        '-show_entries', 'format=duration', 
        '-of', 'default=noprint_wrappers=1:nokey=1', 
        video_path
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        print(f"Error getting video duration: {result.stderr}")
        sys.exit(1)
    return float(result.stdout.strip())

def create_output_directory(video_path, base_dir="website/videos"):
    """Create output directory for the processed video."""
    video_filename = Path(video_path).stem
    output_dir = os.path.join(base_dir, f"{video_filename}-prepared")
    os.makedirs(output_dir, exist_ok=True)
    return output_dir, video_filename

def extract_frame(video_path, output_path, time_position):
    """Extract a single frame at the specified time position."""
    cmd = [
        'ffmpeg',
        '-ss', str(time_position),
        '-i', video_path,
        '-vframes', '1',
        '-q:v', '2',
        output_path
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        print(f"Error extracting frame at {time_position}s: {result.stderr.decode()}")
        return False
    return True

def extract_audio_segment(video_path, output_path, start_time, duration=30):
    """Extract an audio segment starting at the specified time."""
    cmd = [
        'ffmpeg',
        '-ss', str(start_time),
        '-t', str(duration),
        '-i', video_path,
        '-q:a', '0',
        '-map', 'a',
        output_path
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        print(f"Error extracting audio at {start_time}s: {result.stderr.decode()}")
        return False
    return True

def prepare_video(video_path, base_dir="website/videos"):
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
    print(f"Processing {num_segments} segments...")
    
    # Process each segment
    segments = []
    for i in range(num_segments):
        start_time = i * segment_duration
        print(f"Processing segment {i+1}/{num_segments} (starting at {start_time}s)...")
        
        # Extract frame
        frame_path = os.path.join(output_dir, f"frame_{i}.jpg")
        if extract_frame(video_path, frame_path, start_time):
            print(f"  ✓ Extracted frame to {frame_path}")
        else:
            print(f"  ✗ Failed to extract frame")
        
        # Extract audio
        audio_path = os.path.join(output_dir, f"audio_{i}.mp3")
        if extract_audio_segment(video_path, audio_path, start_time, segment_duration):
            print(f"  ✓ Extracted audio to {audio_path}")
        else:
            print(f"  ✗ Failed to extract audio")
        
        # Add segment info
        segments.append({
            "segment": i,
            "startTime": start_time,
            "frameFile": f"frame_{i}.jpg",
            "audioFile": f"audio_{i}.mp3"
        })
    
    # Create metadata file
    metadata = {
        "originalVideo": video_filename,
        "totalDuration": duration,
        "segmentCount": num_segments,
        "segments": segments
    }
    
    metadata_path = os.path.join(output_dir, "metadata.json")
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\nProcessing complete! Metadata saved to {metadata_path}")
    print(f"Created {num_segments} segments in {output_dir}")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process a video file, extracting frames and audio segments every 30 seconds.")
    parser.add_argument("video_path", help="Path to the video file to process")
    parser.add_argument("--output-dir", default="website/videos", help="Base directory for output (default: website/videos)")
    
    args = parser.parse_args()
    
    # Ensure the base output directory exists
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Process the video
    prepare_video(args.video_path, args.output_dir)
