use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Window};

const MAX_RETRIES: u32 = 3;
const INITIAL_RETRY_DELAY_MS: u64 = 1000; // Start with 1 second

#[derive(Debug, Serialize)]
struct TranslationRequest {
    srt_content: String,
    target_language: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TranslationResponse {
    translated_srt: String,
    entry_count: i32,
}

#[derive(Debug, Clone, Serialize)]
pub struct TranslationStartedPayload {
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(rename = "originalSrtPath")]
    pub original_srt_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TranslationCompletePayload {
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(rename = "translatedSrtPath")]
    pub translated_srt_path: String,
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
                        "translation",
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

/// Main translation function
/// If translation fails, copies original SRT to output folder as fallback
pub async fn translate_srt(
    server_url: &str,
    task_id: &str,
    original_srt_path: &str,
    target_language: &str,
    output_folder: &str,
    original_file_path: &str,
    include_language_suffix: bool,
    window: &Window,
    app_handle: &AppHandle,
) -> Result<String> {
    // Get the base filename from the ORIGINAL video file
    let original_file = Path::new(original_file_path);
    let file_stem = original_file
        .file_stem()
        .context("Failed to get file name")?
        .to_str()
        .context("Invalid file name")?;

    // Create final output path for translated SRT
    let final_srt_path = if include_language_suffix {
        // SRT workflow: include language suffix (e.g., subtitle_zh.srt)
        let sanitized_language = target_language.replace(" ", "_");
        Path::new(output_folder).join(format!("{}_{}.srt", file_stem, sanitized_language))
    } else {
        // Video workflow: no language suffix (e.g., video.srt)
        Path::new(output_folder).join(format!("{}.srt", file_stem))
    };
    let final_srt_path_str = final_srt_path
        .to_str()
        .context("Invalid final SRT output path")?
        .to_string();

    crate::logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "metadata",
        &format!("Starting translation to {}...", target_language),
    )
    .await?;

    // Emit translation started event
    window
        .emit(
            "translation:started",
            TranslationStartedPayload {
                task_id: task_id.to_string(),
                original_srt_path: original_srt_path.to_string(),
            },
        )
        .context("Failed to emit translation:started event")?;

    // Read the original SRT content
    let srt_content = tokio::fs::read_to_string(original_srt_path)
        .await
        .context("Failed to read original SRT file")?;

    crate::logger::append_log_entry(
        app_handle,
        window,
        task_id,
        "translation",
        &format!(
            "Sending SRT to translation server: {} (target: {})",
            server_url, target_language
        ),
    )
    .await?;

    // Attempt translation with retry logic
    let translation_result = retry_with_backoff(
        || {
            let server_url = server_url.to_string();
            let srt_content = srt_content.clone();
            let target_language = target_language.to_string();
            async move {
                let client = reqwest::Client::new();
                let request_body = TranslationRequest {
                    srt_content,
                    target_language,
                    source_language: None,
                    country: None,
                    model: None,
                };

                let response = client
                    .post(format!("{}/translate", server_url))
                    .header("Content-Type", "application/json")
                    .json(&request_body)
                    .send()
                    .await
                    .context("Network error during translation request")?;

                if !response.status().is_success() {
                    let status = response.status();
                    let error_text = response.text().await.unwrap_or_default();
                    anyhow::bail!("[HTTP {}] Translation failed: {}", status, error_text);
                }

                let translation_response: TranslationResponse = response
                    .json()
                    .await
                    .context("Failed to parse translation response")?;

                Ok(translation_response)
            }
        },
        "Translation",
        task_id,
        window,
        app_handle,
    )
    .await;

    // Handle translation result with fallback
    match translation_result {
        Ok(response) => {
            // Translation succeeded - save translated SRT
            tokio::fs::write(&final_srt_path_str, &response.translated_srt)
                .await
                .context("Failed to write translated SRT file")?;

            crate::logger::append_log_entry(
                app_handle,
                window,
                task_id,
                "translation",
                &format!(
                    "Translation complete: {} entries translated, saved to {}",
                    response.entry_count, final_srt_path_str
                ),
            )
            .await?;
        }
        Err(e) => {
            // Translation failed - fallback to original SRT
            crate::logger::append_log_entry(
                app_handle,
                window,
                task_id,
                "error",
                &format!("Translation failed: {}. Falling back to original SRT.", e),
            )
            .await?;

            // Copy original SRT to final output location
            tokio::fs::copy(original_srt_path, &final_srt_path_str)
                .await
                .context("Failed to copy original SRT as fallback")?;

            crate::logger::append_log_entry(
                app_handle,
                window,
                task_id,
                "metadata",
                &format!("Original SRT saved to: {}", final_srt_path_str),
            )
            .await?;
        }
    }

    // Emit translation complete event (whether translated or fallback)
    window
        .emit(
            "translation:complete",
            TranslationCompletePayload {
                task_id: task_id.to_string(),
                translated_srt_path: final_srt_path_str.clone(),
            },
        )
        .context("Failed to emit translation:complete event")?;

    Ok(final_srt_path_str)
}
