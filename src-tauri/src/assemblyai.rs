use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Window};

const ASSEMBLYAI_API_BASE: &str = "https://api.eu.assemblyai.com";
const POLL_INTERVAL_SECS: u64 = 3;
const MAX_POLL_ATTEMPTS: u32 = 600; // 30 minutes max (600 * 3 seconds)
const MAX_RETRIES: u32 = 3;
const INITIAL_RETRY_DELAY_MS: u64 = 1000; // Start with 1 second

#[derive(Debug, Serialize, Deserialize)]
struct UploadResponse {
    upload_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CreateTranscriptRequest {
    audio_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct TranscriptResponse {
    id: String,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
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

    // If not JSON, check for common error patterns
    if error_text.contains("401") || error_text.contains("Unauthorized") {
        return format!(
            "{}: Invalid API key. Please check your AssemblyAI API key.",
            context_msg
        );
    }
    if error_text.contains("403") || error_text.contains("Forbidden") {
        return format!(
            "{}: Access denied. Please check your API key permissions.",
            context_msg
        );
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
                        "assemblyai",
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
/// Note: audioPath is a temporary file that will be cleaned up after this event
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

/// Upload audio file to AssemblyAI
async fn upload_audio(
    api_key: &str,
    audio_path: &str,
    task_id: &str,
    window: &Window,
    app_handle: &AppHandle,
) -> Result<String> {
    // Ensure log is written before proceeding
    crate::logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "metadata",
        "Uploading audio to AssemblyAI...",
    )
    .await?;

    // Read the audio file once, before retries
    let file_bytes = tokio::fs::read(audio_path)
        .await
        .context("Failed to read audio file")?;

    let api_key = api_key.to_string();
    let file_bytes_clone = file_bytes.clone();

    // Upload with retry logic
    let upload_url = retry_with_backoff(
        || {
            let api_key = api_key.clone();
            let file_bytes = file_bytes_clone.clone();
            async move {
                let client = reqwest::Client::new();
                let response = client
                    .post(format!("{}/v2/upload", ASSEMBLYAI_API_BASE))
                    .header("Authorization", &api_key)
                    .header("Content-Type", "application/octet-stream")
                    .body(file_bytes)
                    .send()
                    .await
                    .context("Network error during audio upload")?;

                if !response.status().is_success() {
                    let status = response.status();
                    let error_text = response.text().await.unwrap_or_default();
                    let parsed_error = parse_api_error(&error_text, "Upload failed");
                    anyhow::bail!("[HTTP {}] {}", status, parsed_error);
                }

                let upload_response: UploadResponse = response
                    .json()
                    .await
                    .context("Failed to parse upload response")?;

                Ok(upload_response.upload_url)
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
        "assemblyai",
        &format!("Upload complete: {}", upload_url),
    )
    .await?;

    Ok(upload_url)
}

/// Create a transcript request
async fn create_transcript(
    api_key: &str,
    audio_url: &str,
    task_id: &str,
    window: &Window,
    app_handle: &AppHandle,
) -> Result<String> {
    crate::logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "metadata",
        "Creating transcription request...",
    )
    .await?;

    let api_key = api_key.to_string();
    let audio_url = audio_url.to_string();

    // Create transcript with retry logic
    let transcript_id = retry_with_backoff(
        || {
            let api_key = api_key.clone();
            let audio_url = audio_url.clone();
            async move {
                let client = reqwest::Client::new();
                let request_body = CreateTranscriptRequest {
                    audio_url: audio_url.clone(),
                };

                let response = client
                    .post(format!("{}/v2/transcript", ASSEMBLYAI_API_BASE))
                    .header("Authorization", &api_key)
                    .header("Content-Type", "application/json")
                    .json(&request_body)
                    .send()
                    .await
                    .context("Network error during transcript creation")?;

                if !response.status().is_success() {
                    let status = response.status();
                    let error_text = response.text().await.unwrap_or_default();
                    let parsed_error = parse_api_error(&error_text, "Transcript creation failed");
                    anyhow::bail!("[HTTP {}] {}", status, parsed_error);
                }

                let transcript_response: TranscriptResponse = response
                    .json()
                    .await
                    .context("Failed to parse transcript response")?;

                Ok(transcript_response)
            }
        },
        "Create transcript",
        task_id,
        window,
        app_handle,
    )
    .await?;

    crate::logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "assemblyai",
        &format!(
            "Transcript created - ID: {} Status: {}",
            transcript_id.id, transcript_id.status
        ),
    )
    .await?;

    Ok(transcript_id.id)
}

/// Poll transcript status until completion or error
async fn poll_transcript_status(
    api_key: &str,
    transcript_id: &str,
    task_id: &str,
    window: &Window,
    app_handle: &AppHandle,
) -> Result<()> {
    let client = reqwest::Client::new();
    let mut attempts = 0;

    loop {
        if attempts >= MAX_POLL_ATTEMPTS {
            anyhow::bail!(
                "Transcription timeout: exceeded maximum polling attempts (Transcript ID: {})",
                transcript_id
            );
        }

        tokio::time::sleep(Duration::from_secs(POLL_INTERVAL_SECS)).await;
        attempts += 1;

        // Poll with retry logic (network errors only, not status errors)
        let transcript_response = retry_with_backoff(
            || {
                let client = client.clone();
                let api_key = api_key.to_string();
                let transcript_id = transcript_id.to_string();
                async move {
                    let response = client
                        .get(format!(
                            "{}/v2/transcript/{}",
                            ASSEMBLYAI_API_BASE, transcript_id
                        ))
                        .header("Authorization", &api_key)
                        .send()
                        .await
                        .context("Network error during status polling")?;

                    if !response.status().is_success() {
                        let status = response.status();
                        let error_text = response.text().await.unwrap_or_default();
                        let parsed_error = parse_api_error(&error_text, "Status polling failed");
                        anyhow::bail!(
                            "[HTTP {}] {} (Transcript ID: {})",
                            status,
                            parsed_error,
                            transcript_id
                        );
                    }

                    let transcript_response: TranscriptResponse = response
                        .json()
                        .await
                        .context("Failed to parse status response")?;

                    Ok(transcript_response)
                }
            },
            "Poll transcript status",
            task_id,
            window,
            app_handle,
        )
        .await?;

        // Log first, then emit event to maintain ordering
        crate::logger::append_log_entry(
            app_handle,
            window,
            task_id,
            "assemblyai",
            &format!(
                "Poll attempt {}: Status = {} (ID: {})",
                attempts, transcript_response.status, transcript_id
            ),
        )
        .await?;

        // Emit polling event after logging
        window
            .emit(
                "transcription:polling",
                TranscriptionPollingPayload {
                    task_id: task_id.to_string(),
                    status: transcript_response.status.clone(),
                },
            )
            .ok();

        match transcript_response.status.as_str() {
            "completed" => {
                crate::logger::append_log_entry(
                    app_handle,
                    window,
                    task_id,
                    "assemblyai",
                    &format!(
                        "Transcription completed successfully! (ID: {})",
                        transcript_id
                    ),
                )
                .await?;
                return Ok(());
            }
            "error" => {
                let error_msg = transcript_response
                    .error
                    .unwrap_or_else(|| "Unknown error".to_string());
                anyhow::bail!(
                    "Transcription failed (ID: {}): {}",
                    transcript_id,
                    error_msg
                );
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
                    "assemblyai",
                    &format!(
                        "Unknown status: {} (ID: {})",
                        transcript_response.status, transcript_id
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
    api_key: &str,
    transcript_id: &str,
    temp_srt_path: &str,
    task_id: &str,
    window: &Window,
    app_handle: &AppHandle,
) -> Result<()> {
    // Ensure log is written before proceeding
    crate::logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "metadata",
        "Downloading original SRT subtitle file to temp folder...",
    )
    .await?;

    let api_key = api_key.to_string();
    let transcript_id_str = transcript_id.to_string();

    // Download with retry logic
    let srt_content = retry_with_backoff(
        || {
            let api_key = api_key.clone();
            let transcript_id = transcript_id_str.clone();
            async move {
                let client = reqwest::Client::new();
                let response = client
                    .get(format!(
                        "{}/v2/transcript/{}/srt",
                        ASSEMBLYAI_API_BASE, transcript_id
                    ))
                    .header("Authorization", &api_key)
                    .send()
                    .await
                    .context("Network error during SRT download")?;

                if !response.status().is_success() {
                    let status = response.status();
                    let error_text = response.text().await.unwrap_or_default();
                    let parsed_error = parse_api_error(&error_text, "SRT download failed");
                    anyhow::bail!(
                        "[HTTP {}] {} (Transcript ID: {})",
                        status,
                        parsed_error,
                        transcript_id
                    );
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
        "assemblyai",
        &format!(
            "Original SRT file saved to temp: {} (ID: {})",
            temp_srt_path, transcript_id
        ),
    )
    .await?;

    Ok(())
}

/// Main transcription orchestration function
/// Returns the path to the original SRT file in the temp directory (for translation)
pub async fn transcribe_audio(
    api_key: &str,
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

    // Ensure initial log is written before starting
    crate::logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "metadata",
        &format!("Starting transcription for: {}", audio_path),
    )
    .await?;

    // Step 1: Upload audio
    let upload_url = upload_audio(api_key, audio_path, task_id, window, app_handle).await?;

    // Step 2: Create transcript
    let transcript_id =
        create_transcript(api_key, &upload_url, task_id, window, app_handle).await?;

    // Emit transcription started event AFTER logs are written
    window
        .emit(
            "transcription:started",
            TranscriptionStartedPayload {
                task_id: task_id.to_string(),
                transcript_id: transcript_id.clone(),
            },
        )
        .context("Failed to emit transcription:started event")?;

    // Step 3: Poll until complete
    poll_transcript_status(api_key, &transcript_id, task_id, window, app_handle).await?;

    // Step 4: Download SRT to temp folder
    download_srt(
        api_key,
        &transcript_id,
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

    // Don't emit transcription:complete here anymore - translation will handle final completion
    // Return the temp SRT path for translation

    Ok(temp_srt_path_str)
}
