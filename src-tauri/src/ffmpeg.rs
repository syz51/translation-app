use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::{AppHandle, Emitter, Manager, Window};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::logger;

// Windows-specific imports for hiding console window
// The CommandExt trait is required for the creation_flags method
#[cfg(target_os = "windows")]
#[allow(unused_imports)]
use std::os::windows::process::CommandExt;

// CREATE_NO_WINDOW flag to prevent console window from appearing
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInfo {
    pub id: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
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

/// Get the path to a bundled binary, falling back to system PATH in dev mode
fn get_binary_path(app_handle: &AppHandle, binary_name: &str) -> Result<PathBuf> {
    use tauri::Manager;

    // Check if we're in development mode by attempting to resolve the resource path
    // In dev mode, this will typically fail or point to a non-existent location
    let is_dev_mode = cfg!(debug_assertions);

    if is_dev_mode {
        // In development, use the system PATH
        return Ok(PathBuf::from(binary_name));
    }

    // In production, resolve externalBin from the app directory
    // For externalBin, Tauri places binaries in:
    // - Windows: same directory as .exe
    // - macOS: Contents/MacOS/
    // - Linux: same directory as executable

    // Add .exe extension on Windows
    let binary_name_with_ext = if cfg!(target_os = "windows") {
        format!("{}.exe", binary_name)
    } else {
        binary_name.to_string()
    };

    // Get the app's executable directory
    let exe_dir = app_handle
        .path()
        .resolve("", tauri::path::BaseDirectory::Resource)
        .context("Failed to resolve exe path")?;

    // On macOS, externalBin is in MacOS folder (sibling to Resources)
    #[cfg(target_os = "macos")]
    let binary_dir = exe_dir.join("MacOS");

    // On Windows and Linux, externalBin is in the same directory as the exe
    #[cfg(not(target_os = "macos"))]
    let binary_dir = exe_dir;

    let sidecar_path = binary_dir.join(&binary_name_with_ext);

    if !sidecar_path.exists() {
        anyhow::bail!(
            "Bundled binary not found: {}. Please ensure ffmpeg binaries are bundled with the application.",
            sidecar_path.display()
        );
    }

    Ok(sidecar_path)
}

/// Extract audio from a video file to WAV format
/// Returns the path to the extracted audio file in the temp directory
pub async fn extract_audio_to_wav(
    task_id: &str,
    input_path: &str,
    window: &Window,
    app_handle: &AppHandle,
) -> Result<String> {
    // Initialize task log
    logger::init_task_log(app_handle, task_id)
        .await
        .context("Failed to initialize task log")?;

    // Log task metadata
    logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "metadata",
        &format!("Starting audio extraction for: {}", input_path),
    )
    .await?;

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

    // Create output path in temp directory
    let temp_dir = app_handle
        .path()
        .temp_dir()
        .context("Failed to get temp directory")?;

    // Create a subdirectory for audio extraction
    let audio_temp_dir = temp_dir.join("translation-app-audio");
    std::fs::create_dir_all(&audio_temp_dir).context("Failed to create audio temp directory")?;

    let output_path = audio_temp_dir.join(format!("{}_{}.wav", task_id, file_stem));
    let output_path_str = output_path
        .to_str()
        .context("Invalid output path")?
        .to_string();

    logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "metadata",
        &format!("Extracting audio to temp file: {}", output_path_str),
    )
    .await?;

    // Get ffmpeg binary path
    let ffmpeg_path = get_binary_path(app_handle, "ffmpeg")?;

    logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "metadata",
        "Starting ffmpeg extraction...",
    )
    .await?;

    // Build ffmpeg command
    let mut cmd = Command::new(ffmpeg_path);
    cmd.arg("-i")
        .arg(input_path)
        .arg("-vn") // No video
        .arg("-acodec")
        .arg("pcm_s16le") // WAV codec
        .arg("-ar")
        .arg("16000") // Sample rate
        .arg("-ac")
        .arg("1") // Mono
        .arg("-y") // Overwrite output file
        .arg(&output_path_str)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // On Windows, prevent console window from appearing
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd.spawn().context("Failed to spawn ffmpeg process")?;

    // Create handles for the reader tasks
    let stderr_handle = if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        let window_clone = window.clone();
        let app_handle_clone = app_handle.clone();
        let task_id_clone = task_id.to_string();

        Some(tokio::spawn(async move {
            while let Ok(Some(line)) = lines.next_line().await {
                // Log the ffmpeg output
                let _ = logger::append_log_entry(
                    &app_handle_clone,
                    &window_clone,
                    &task_id_clone,
                    "ffmpeg",
                    &line,
                )
                .await;
            }
        }))
    } else {
        None
    };

    // Read stdout if needed
    let stdout_handle = if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        let window_clone = window.clone();
        let app_handle_clone = app_handle.clone();
        let task_id_clone = task_id.to_string();

        Some(tokio::spawn(async move {
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = logger::append_log_entry(
                    &app_handle_clone,
                    &window_clone,
                    &task_id_clone,
                    "ffmpeg",
                    &line,
                )
                .await;
            }
        }))
    } else {
        None
    };

    // Wait for the process to complete
    let output = child.wait().await.context("Failed to wait for ffmpeg")?;

    // Wait for log readers to complete before proceeding
    if let Some(handle) = stderr_handle {
        let _ = handle.await;
    }
    if let Some(handle) = stdout_handle {
        let _ = handle.await;
    }

    if !output.success() {
        let error_msg = format!("FFmpeg process failed with status: {}", output);
        logger::append_log_entry(app_handle, window, task_id, "error", &error_msg).await?;
        anyhow::bail!(error_msg);
    }

    logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "metadata",
        "FFmpeg extraction completed successfully",
    )
    .await?;

    // Don't emit task:completed here - this is just audio extraction phase
    // The task will be marked as completed after transcription finishes

    Ok(output_path_str)
}
