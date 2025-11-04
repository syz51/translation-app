use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Stdio;
use tauri::{Emitter, Window};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInfo {
    pub id: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProgressPayload {
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub progress: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskStartedPayload {
    #[serde(rename = "taskId")]
    pub task_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskCompletePayload {
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(rename = "outputPath")]
    pub output_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskErrorPayload {
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub error: String,
}

/// Extract audio from a video file to WAV format
pub async fn extract_audio_to_wav(
    task_id: &str,
    input_path: &str,
    output_folder: &str,
    window: &Window,
) -> Result<String> {
    // Emit task started event
    window
        .emit(
            "task:started",
            TaskStartedPayload {
                task_id: task_id.to_string(),
            },
        )
        .context("Failed to emit task:started event")?;

    // Get the input file name without extension
    let input_file = Path::new(input_path);
    let file_stem = input_file
        .file_stem()
        .context("Failed to get file name")?
        .to_str()
        .context("Invalid file name")?;

    // Create output path
    let output_path = Path::new(output_folder).join(format!("{}.wav", file_stem));
    let output_path_str = output_path
        .to_str()
        .context("Invalid output path")?
        .to_string();

    // Get video duration first for progress calculation
    let duration = get_video_duration(input_path).await?;

    // Build ffmpeg command
    let mut child = Command::new("ffmpeg")
        .arg("-i")
        .arg(input_path)
        .arg("-vn") // No video
        .arg("-acodec")
        .arg("pcm_s16le") // WAV codec
        .arg("-ar")
        .arg("44100") // Sample rate
        .arg("-ac")
        .arg("2") // Stereo
        .arg("-y") // Overwrite output file
        .arg(&output_path_str)
        .arg("-progress")
        .arg("pipe:2") // Progress to stderr
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("Failed to spawn ffmpeg process")?;

    // Read stderr for progress updates
    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        let window_clone = window.clone();
        let task_id_clone = task_id.to_string();

        tokio::spawn(async move {
            while let Ok(Some(line)) = lines.next_line().await {
                if let Some(progress) = parse_progress(&line, duration) {
                    let _ = window_clone.emit(
                        "task:progress",
                        ProgressPayload {
                            task_id: task_id_clone.clone(),
                            progress,
                        },
                    );
                }
            }
        });
    }

    // Wait for the process to complete
    let output = child.wait().await.context("Failed to wait for ffmpeg")?;

    if !output.success() {
        anyhow::bail!("FFmpeg process failed with status: {}", output);
    }

    // Emit completion event
    window
        .emit(
            "task:completed",
            TaskCompletePayload {
                task_id: task_id.to_string(),
                output_path: output_path_str.clone(),
            },
        )
        .context("Failed to emit task:completed event")?;

    Ok(output_path_str)
}

/// Get the duration of a video file in seconds
async fn get_video_duration(input_path: &str) -> Result<f32> {
    let output = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(input_path)
        .output()
        .await
        .context("Failed to run ffprobe")?;

    if !output.status.success() {
        anyhow::bail!("ffprobe failed to get video duration");
    }

    let duration_str = String::from_utf8(output.stdout)
        .context("Invalid ffprobe output")?
        .trim()
        .to_string();

    duration_str
        .parse::<f32>()
        .context("Failed to parse duration")
}

/// Parse ffmpeg progress output
fn parse_progress(line: &str, total_duration: f32) -> Option<f32> {
    // ffmpeg outputs "out_time_ms=..." for progress
    if line.starts_with("out_time_ms=") {
        let time_str = line.strip_prefix("out_time_ms=")?;
        let time_microseconds: i64 = time_str.parse().ok()?;
        let time_seconds = time_microseconds as f32 / 1_000_000.0;
        let progress = (time_seconds / total_duration * 100.0).min(100.0);
        return Some(progress);
    }
    None
}
