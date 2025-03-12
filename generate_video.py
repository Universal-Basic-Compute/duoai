import os
import sys
import json
import argparse
import subprocess
import tempfile
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def check_audio_streams(video_path):
    """Check audio streams in the video file."""
    cmd = [
        'ffprobe',
        '-v', 'error',
        '-select_streams', 'a',
        '-show_entries', 'stream=index,codec_name,channels',
        '-of', 'json',
        video_path
    ]
    
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode == 0:
            audio_info = json.loads(result.stdout)
            print(f"Audio streams in input video: {json.dumps(audio_info, indent=2)}")
            return audio_info
        else:
            print(f"Error checking audio streams: {result.stderr}")
            return None
    except Exception as e:
        print(f"Exception during audio stream check: {str(e)}")
        return None

def verify_output_video(video_path):
    """Verify that the output video has audio."""
    cmd = [
        'ffprobe',
        '-v', 'error',
        '-select_streams', 'a',
        '-show_entries', 'stream=codec_type',
        '-of', 'json',
        video_path
    ]
    
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode == 0:
            info = json.loads(result.stdout)
            has_audio = 'streams' in info and len(info['streams']) > 0
            print(f"Output video has audio: {has_audio}")
            return has_audio
        else:
            print(f"Error verifying output video: {result.stderr}")
            return False
    except Exception as e:
        print(f"Exception during output verification: {str(e)}")
        return False

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

def get_audio_duration(audio_path, timeout=10):
    """Get the duration of an audio file using ffprobe."""
    cmd = [
        'ffprobe', 
        '-v', 'error', 
        '-show_entries', 'format=duration', 
        '-of', 'default=noprint_wrappers=1:nokey=1', 
        audio_path
    ]
    
    try:
        result = subprocess.run(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            text=True,
            timeout=timeout
        )
        
        if result.returncode != 0:
            print(f"Error getting audio duration: {result.stderr}")
            return 0
        
        return float(result.stdout.strip())
    except Exception as e:
        print(f"Exception during audio duration check: {str(e)}")
        return 0

def generate_video_with_advice(input_video_path, transcript_folder_path, output_video_path=None):
    """
    Generate a new video with the original audio reduced to 20% and advice audio overlaid.
    
    Args:
        input_video_path: Path to the original video
        transcript_folder_path: Path to the folder containing transcripts and advice audio
        output_video_path: Path for the output video (if None, will be generated based on input)
    """
    # Validate input paths
    if not os.path.exists(input_video_path):
        print(f"Error: Input video not found at {input_video_path}")
        return False
    
    if not os.path.exists(transcript_folder_path):
        print(f"Error: Transcript folder not found at {transcript_folder_path}")
        return False
        
    # Check audio streams in input video
    audio_streams = check_audio_streams(input_video_path)
    if not audio_streams or 'streams' not in audio_streams or len(audio_streams['streams']) == 0:
        print("Warning: No audio streams found in input video")
    
    # Generate output path if not provided
    if output_video_path is None:
        input_video_name = Path(input_video_path).stem
        output_video_path = os.path.join(os.path.dirname(input_video_path), f"{input_video_name}_with_advice.mp4")
    
    # Check if metadata.json exists in the transcript folder
    metadata_path = os.path.join(transcript_folder_path, "metadata.json")
    if not os.path.exists(metadata_path):
        print(f"Error: metadata.json not found in {transcript_folder_path}")
        return False
    
    # Load metadata
    try:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        segments = metadata.get("segments", [])
        if not segments:
            print("Error: No segments found in metadata")
            return False
        
        print(f"Found {len(segments)} segments in metadata")
    except Exception as e:
        print(f"Error loading metadata: {str(e)}")
        return False
    
    # Create a temporary directory for intermediate files
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"Created temporary directory: {temp_dir}")
        
        # Step 1: Create a version of the original video with audio volume reduced to 20%
        reduced_audio_video_path = os.path.join(temp_dir, "reduced_audio.mp4")
        
        cmd = [
            'ffmpeg',
            '-i', input_video_path,
            '-filter_complex', '[0:a]volume=0.0[a]',
            '-map', '0:v',
            '-map', '[a]',
            '-c:v', 'copy',
            reduced_audio_video_path
        ]
        
        print("Reducing original audio volume to 20%...")
        try:
            subprocess.run(cmd, check=True)
            print("✓ Audio volume reduced successfully")
        except subprocess.CalledProcessError as e:
            print(f"Error reducing audio volume: {e}")
            return False
        
        # Step 2: Prepare the filter complex for overlaying advice audio
        filter_complex = []
        input_count = 1  # Start with 1 for the reduced audio video
        
        # Track the end time of the last advice to avoid overlaps
        last_advice_end_time = 0
        
        # Collect all advice segments that have speech files
        advice_segments = []
        
        for segment in segments:
            segment_num = segment.get("segment")
            start_time = segment.get("startTime", 0)
            speech_file = segment.get("speechFile")
            
            if not speech_file:
                continue
            
            speech_path = os.path.join(transcript_folder_path, speech_file)
            if not os.path.exists(speech_path):
                print(f"Warning: Speech file not found: {speech_path}")
                continue
            
            # Get the duration of the speech file
            speech_duration = get_audio_duration(speech_path)
            if speech_duration <= 0:
                print(f"Warning: Could not determine duration of {speech_path}")
                continue
            
            # Calculate end time of this advice
            end_time = start_time + speech_duration
            
            # Add to our list of advice segments
            advice_segments.append({
                "segment_num": segment_num,
                "start_time": start_time,
                "end_time": end_time,
                "speech_path": speech_path,
                "speech_duration": speech_duration
            })
        
        # Sort advice segments by start time
        advice_segments.sort(key=lambda x: x["start_time"])
        
        # Filter out overlapping segments
        filtered_advice_segments = []
        for segment in advice_segments:
            if segment["start_time"] >= last_advice_end_time:
                filtered_advice_segments.append(segment)
                last_advice_end_time = segment["end_time"]
            else:
                print(f"Skipping segment {segment['segment_num']} due to overlap with previous advice")
        
        print(f"Using {len(filtered_advice_segments)} advice segments (skipped {len(advice_segments) - len(filtered_advice_segments)} due to overlaps)")
        
        # If no advice segments remain, just copy the reduced audio video
        if not filtered_advice_segments:
            print("No advice segments to overlay, copying reduced audio video...")
            cmd = [
                'ffmpeg',
                '-i', reduced_audio_video_path,
                '-c', 'copy',
                output_video_path
            ]
            
            try:
                subprocess.run(cmd, check=True)
                print(f"✓ Video saved to {output_video_path}")
                return True
            except subprocess.CalledProcessError as e:
                print(f"Error copying video: {e}")
                return False
        
        # Build the filter complex for overlaying advice audio
        inputs = [reduced_audio_video_path]
        filter_parts = []
        
        # Add input for each advice audio file
        for i, segment in enumerate(filtered_advice_segments):
            inputs.append(segment["speech_path"])
            
            # Add adelay filter to position the audio at the right timestamp
            # adelay takes delay in milliseconds
            delay_ms = int(segment["start_time"] * 1000)
            filter_parts.append(f"[{i+1}:a]adelay={delay_ms}|{delay_ms}[a{i+1}]")
        
        # Mix all audio streams
        mix_inputs = "[0:a]"  # Start with the reduced original audio
        for i in range(len(filtered_advice_segments)):
            mix_inputs += f"[a{i+1}]"
        
        filter_parts.append(f"{mix_inputs}amix=inputs={len(filtered_advice_segments)+1}:duration=longest:normalize=0[aout]")
        
        # Combine all filter parts
        filter_complex = ";".join(filter_parts)
        
        # Step 3: Create the final video with overlaid advice audio
        cmd = [
            'ffmpeg',
            *sum([['-i', input_path] for input_path in inputs], []),  # Flatten the input arguments
            '-filter_complex', filter_complex,
            '-map', '0:v',
            '-map', '[aout]',
            '-c:v', 'copy',
            output_video_path
        ]
        
        print("Creating final video with overlaid advice audio...")
        try:
            subprocess.run(cmd, check=True)
            print(f"✓ Video successfully created: {output_video_path}")
            
            # Verify that the output video has audio
            if os.path.exists(output_video_path):
                has_audio = verify_output_video(output_video_path)
                if not has_audio:
                    print("Warning: Output video does not have audio!")
            
            return True
        except subprocess.CalledProcessError as e:
            print(f"Error creating final video: {e}")
            return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a video with advice audio overlaid on the original video.")
    parser.add_argument("input_video", help="Path to the original video file")
    parser.add_argument("transcript_folder", help="Path to the folder containing transcripts and advice audio")
    parser.add_argument("--output", help="Path for the output video (optional, default is next to original)")
    
    args = parser.parse_args()
    
    # Check if FFmpeg is installed
    if not check_ffmpeg():
        print("Please install FFmpeg and make sure it's in your PATH.")
        sys.exit(1)
    
    # Generate the video
    success = generate_video_with_advice(args.input_video, args.transcript_folder, args.output)
    
    if success:
        print("Video generation completed successfully!")
    else:
        print("Video generation failed.")
        sys.exit(1)
