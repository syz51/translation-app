use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Window};

const POLL_INTERVAL_SECS: u64 = 3;
const MAX_POLL_ATTEMPTS: u32 = 600; // 30 minutes max (600 * 3 seconds)
const MAX_RETRIES: u32 = 3;
const INITIAL_RETRY_DELAY_MS: u64 = 1000; // Start with 1 second

#[derive(Debug, Serialize, Deserialize)]
struct CreateTranscriptionResponse {
    job_id: String,
    status: String,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct TranscriptionStatusResponse {
    job_id: String,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    progress: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    completed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ApiErrorResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

/// Helper function to parse and format API error messages
fn parse_api_error(error_text: &str, context_msg: &str) -> String {
    // Try to parse as JSON error response
    if let Ok(error_response) = serde_json::from_str::<ApiErrorResponse>(error_text) {
        let error_msg = error_response
            .error
            .or(error_response.message)
            .unwrap_or_else(|| "Unknown error".to_string());
        return format!("{}: {}", context_msg, error_msg);
    }

    // Check for common HTTP error patterns
    if error_text.contains("401") || error_text.contains("Unauthorized") {
        return format!(
            "{}: Unauthorized. Backend authentication failed.",
            context_msg
        );
    }
    if error_text.contains("403") || error_text.contains("Forbidden") {
        return format!("{}: Access denied.", context_msg);
    }
    if error_text.contains("429") || error_text.contains("Too Many Requests") {
        return format!(
            "{}: Rate limit exceeded. Please try again later.",
            context_msg
        );
    }

    // Default to original error text
    format!("{}: {}", context_msg, error_text)
}

/// Retry a function with exponential backoff
async fn retry_with_backoff<F, Fut, T>(
    mut operation: F,
    operation_name: &str,
    task_id: &str,
    window: &Window,
    app_handle: &AppHandle,
) -> Result<T>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T>>,
{
    let mut last_error = None;

    for attempt in 0..MAX_RETRIES {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                last_error = Some(e);

                // Don't retry on the last attempt
                if attempt < MAX_RETRIES - 1 {
                    let delay = INITIAL_RETRY_DELAY_MS * 2u64.pow(attempt);

                    let _ = crate::logger::append_log_entry(
                        app_handle,
                        window,
                        task_id,
                        "transcription",
                        &format!(
                            "{} failed (attempt {}/{}), retrying in {}ms...",
                            operation_name,
                            attempt + 1,
                            MAX_RETRIES,
                            delay
                        ),
                    )
                    .await;

                    tokio::time::sleep(Duration::from_millis(delay)).await;
                }
            }
        }
    }

    // All retries exhausted
    Err(last_error.unwrap())
}

#[derive(Debug, Clone, Serialize)]
pub struct TranscriptionStartedPayload {
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(rename = "transcriptId")]
    pub transcript_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TranscriptionPollingPayload {
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub status: String,
}

/// Payload for transcription complete event
#[derive(Debug, Clone, Serialize)]
pub struct TranscriptionCompletePayload {
    #[serde(rename = "taskId")]
    pub task_id: String,
    /// Path to the temporary audio file (will be cleaned up)
    #[serde(rename = "audioPath")]
    pub audio_path: String,
    /// Path to the final SRT transcript file
    #[serde(rename = "transcriptPath")]
    pub transcript_path: String,
}

/// Upload audio file to backend transcription service
async fn upload_audio(
    backend_url: &str,
    audio_path: &str,
    task_id: &str,
    window: &Window,
    app_handle: &AppHandle,
) -> Result<String> {
    crate::logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "metadata",
        "Uploading audio to transcription backend...",
    )
    .await?;

    // Read the audio file
    let file_bytes = tokio::fs::read(audio_path)
        .await
        .context("Failed to read audio file")?;

    let audio_filename = Path::new(audio_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("audio.wav");

    let backend_url = backend_url.to_string();
    let audio_filename = audio_filename.to_string();
    let file_bytes_clone = file_bytes.clone();

    // Upload with retry logic
    let job_id = retry_with_backoff(
        || {
            let backend_url = backend_url.clone();
            let audio_filename = audio_filename.clone();
            let file_bytes = file_bytes_clone.clone();
            async move {
                let client = reqwest::Client::new();

                // Create multipart form
                let part = reqwest::multipart::Part::bytes(file_bytes).file_name(audio_filename);
                let form = reqwest::multipart::Form::new()
                    .part("audio_file", part)
                    .text("language_detection", "true")
                    .text("speaker_labels", "true");

                let response = client
                    .post(format!("{}/transcriptions", backend_url))
                    .multipart(form)
                    .send()
                    .await
                    .context("Network error during audio upload")?;

                if !response.status().is_success() {
                    let status = response.status();
                    let error_text = response.text().await.unwrap_or_default();
                    let parsed_error = parse_api_error(&error_text, "Upload failed");
                    anyhow::bail!("[HTTP {}] {}", status, parsed_error);
                }

                let create_response: CreateTranscriptionResponse = response
                    .json()
                    .await
                    .context("Failed to parse create transcription response")?;

                Ok(create_response.job_id)
            }
        },
        "Upload audio",
        task_id,
        window,
        app_handle,
    )
    .await?;

    crate::logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "transcription",
        &format!("Upload complete. Job ID: {}", job_id),
    )
    .await?;

    Ok(job_id)
}

/// Poll transcription status until completion or error
async fn poll_transcription_status(
    backend_url: &str,
    job_id: &str,
    task_id: &str,
    window: &Window,
    app_handle: &AppHandle,
) -> Result<()> {
    let client = reqwest::Client::new();
    let mut attempts = 0;

    loop {
        if attempts >= MAX_POLL_ATTEMPTS {
            anyhow::bail!(
                "Transcription timeout: exceeded maximum polling attempts (Job ID: {})",
                job_id
            );
        }

        tokio::time::sleep(Duration::from_secs(POLL_INTERVAL_SECS)).await;
        attempts += 1;

        // Poll with retry logic (network errors only, not status errors)
        let status_response = retry_with_backoff(
            || {
                let client = client.clone();
                let backend_url = backend_url.to_string();
                let job_id = job_id.to_string();
                async move {
                    let response = client
                        .get(format!("{}/transcriptions/{}", backend_url, job_id))
                        .send()
                        .await
                        .context("Network error during status polling")?;

                    if !response.status().is_success() {
                        let status = response.status();
                        let error_text = response.text().await.unwrap_or_default();
                        let parsed_error = parse_api_error(&error_text, "Status polling failed");
                        anyhow::bail!("[HTTP {}] {} (Job ID: {})", status, parsed_error, job_id);
                    }

                    let status_response: TranscriptionStatusResponse = response
                        .json()
                        .await
                        .context("Failed to parse status response")?;

                    Ok(status_response)
                }
            },
            "Poll transcription status",
            task_id,
            window,
            app_handle,
        )
        .await?;

        // Log status
        let progress_str = status_response
            .progress
            .map(|p| format!(" ({}%)", p))
            .unwrap_or_default();

        crate::logger::append_log_entry(
            app_handle,
            window,
            task_id,
            "transcription",
            &format!(
                "Poll attempt {}: Status = {}{} (Job ID: {})",
                attempts, status_response.status, progress_str, job_id
            ),
        )
        .await?;

        // Emit polling event
        window
            .emit(
                "transcription:polling",
                TranscriptionPollingPayload {
                    task_id: task_id.to_string(),
                    status: status_response.status.clone(),
                },
            )
            .ok();

        match status_response.status.as_str() {
            "completed" => {
                crate::logger::append_log_entry(
                    app_handle,
                    window,
                    task_id,
                    "transcription",
                    &format!("Transcription completed successfully! (Job ID: {})", job_id),
                )
                .await?;
                return Ok(());
            }
            "error" => {
                let error_msg = status_response
                    .error
                    .unwrap_or_else(|| "Unknown error".to_string());
                anyhow::bail!("Transcription failed (Job ID: {}): {}", job_id, error_msg);
            }
            "queued" | "processing" => {
                // Continue polling
                continue;
            }
            _ => {
                crate::logger::append_log_entry(
                    app_handle,
                    window,
                    task_id,
                    "transcription",
                    &format!(
                        "Unknown status: {} (Job ID: {})",
                        status_response.status, job_id
                    ),
                )
                .await?;
                continue;
            }
        }
    }
}

/// Download SRT subtitle file to temp folder with -original.srt suffix
async fn download_srt(
    backend_url: &str,
    job_id: &str,
    temp_srt_path: &str,
    task_id: &str,
    window: &Window,
    app_handle: &AppHandle,
) -> Result<()> {
    crate::logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "metadata",
        "Downloading original SRT subtitle file to temp folder...",
    )
    .await?;

    let backend_url = backend_url.to_string();
    let job_id_str = job_id.to_string();

    // Download with retry logic
    let srt_content = retry_with_backoff(
        || {
            let backend_url = backend_url.clone();
            let job_id = job_id_str.clone();
            async move {
                let client = reqwest::Client::new();
                let response = client
                    .get(format!("{}/transcriptions/{}/srt", backend_url, job_id))
                    .send()
                    .await
                    .context("Network error during SRT download")?;

                if !response.status().is_success() {
                    let status = response.status();
                    let error_text = response.text().await.unwrap_or_default();
                    let parsed_error = parse_api_error(&error_text, "SRT download failed");
                    anyhow::bail!("[HTTP {}] {} (Job ID: {})", status, parsed_error, job_id);
                }

                let srt_content = response
                    .text()
                    .await
                    .context("Failed to read SRT content")?;

                Ok(srt_content)
            }
        },
        "Download SRT",
        task_id,
        window,
        app_handle,
    )
    .await?;

    // Write SRT file to temp location
    tokio::fs::write(temp_srt_path, srt_content)
        .await
        .context("Failed to write SRT file")?;

    crate::logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "transcription",
        &format!(
            "Original SRT file saved to temp: {} (Job ID: {})",
            temp_srt_path, job_id
        ),
    )
    .await?;

    Ok(())
}

/// Main transcription orchestration function
/// Returns the path to the original SRT file in the temp directory (for translation)
pub async fn transcribe_audio(
    backend_url: &str,
    task_id: &str,
    audio_path: &str,
    original_file_path: &str,
    window: &Window,
    app_handle: &AppHandle,
) -> Result<String> {
    // Get the base filename without extension from the ORIGINAL file, not the temp audio file
    let original_file = Path::new(original_file_path);
    let file_stem = original_file
        .file_stem()
        .context("Failed to get file name")?
        .to_str()
        .context("Invalid file name")?;

    // Create temp directory for original SRT (will be translated later)
    let temp_dir = app_handle
        .path()
        .temp_dir()
        .context("Failed to get temp directory")?;

    let srt_temp_dir = temp_dir.join("translation-app-srt");
    std::fs::create_dir_all(&srt_temp_dir).context("Failed to create SRT temp directory")?;

    // Save with -original.srt suffix in temp folder
    let temp_srt_path = srt_temp_dir.join(format!("{}_{}-original.srt", task_id, file_stem));
    let temp_srt_path_str = temp_srt_path
        .to_str()
        .context("Invalid temp SRT path")?
        .to_string();

    crate::logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "metadata",
        &format!("Starting transcription for: {}", audio_path),
    )
    .await?;

    // Step 1: Upload audio and create transcription job
    let job_id = upload_audio(backend_url, audio_path, task_id, window, app_handle).await?;

    // Emit transcription started event AFTER logs are written
    window
        .emit(
            "transcription:started",
            TranscriptionStartedPayload {
                task_id: task_id.to_string(),
                transcript_id: job_id.clone(),
            },
        )
        .context("Failed to emit transcription:started event")?;

    // Step 2: Poll until complete
    poll_transcription_status(backend_url, &job_id, task_id, window, app_handle).await?;

    // Step 3: Download SRT to temp folder
    download_srt(
        backend_url,
        &job_id,
        &temp_srt_path_str,
        task_id,
        window,
        app_handle,
    )
    .await?;

    crate::logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "metadata",
        "Transcription completed! Original SRT ready for translation.",
    )
    .await?;

    Ok(temp_srt_path_str)
}
