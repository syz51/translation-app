mod backend_transcription;
mod ffmpeg;
mod logger;
mod translation;

use ffmpeg::{extract_audio_to_wav, TaskErrorPayload, TaskInfo};
use serde::Serialize;
use tauri::{Emitter, Window};

#[derive(Debug, Clone, Serialize)]
struct BatchCompletePayload {}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn extract_audio_batch(
    tasks: Vec<TaskInfo>,
    output_folder: String,
    transcription_server_url: String,
    target_language: String,
    translation_server_url: String,
    window: Window,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Process up to 4 tasks in parallel
    let mut handles = Vec::new();
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(4));

    for task in tasks {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        let window_clone = window.clone();
        let output_folder_clone = output_folder.clone();
        let app_handle_clone = app_handle.clone();
        let transcription_server_url_clone = transcription_server_url.clone();
        let target_language_clone = target_language.clone();
        let translation_server_url_clone = translation_server_url.clone();

        let handle = tokio::spawn(async move {
            // Step 1: Extract audio to temp directory
            let extraction_result =
                extract_audio_to_wav(&task.id, &task.file_path, &window_clone, &app_handle_clone)
                    .await;

            match extraction_result {
                Ok(audio_path) => {
                    // Step 2: Transcribe audio (returns temp SRT path)
                    let transcription_result = backend_transcription::transcribe_audio(
                        &transcription_server_url_clone,
                        &task.id,
                        &audio_path,
                        &task.file_path,
                        &window_clone,
                        &app_handle_clone,
                    )
                    .await;

                    match transcription_result {
                        Ok(original_srt_path) => {
                            // Step 3: Translate SRT (with fallback to original on failure)
                            let translation_result = translation::translate_srt(
                                &translation_server_url_clone,
                                &task.id,
                                &original_srt_path,
                                &target_language_clone,
                                &output_folder_clone,
                                &task.file_path,
                                false, // Video workflow: no language suffix
                                &window_clone,
                                &app_handle_clone,
                            )
                            .await;

                            match translation_result {
                                Ok(_final_srt_path) => {
                                    // Success: Clean up temp audio and temp original SRT
                                    let mut cleanup_errors = Vec::new();

                                    if let Err(e) = tokio::fs::remove_file(&audio_path).await {
                                        cleanup_errors.push(format!("temp audio: {}", e));
                                    }

                                    if let Err(e) = tokio::fs::remove_file(&original_srt_path).await
                                    {
                                        cleanup_errors.push(format!("temp SRT: {}", e));
                                    }

                                    if !cleanup_errors.is_empty() {
                                        let _ = logger::append_log_entry(
                                            &app_handle_clone,
                                            &window_clone,
                                            &task.id,
                                            "metadata",
                                            &format!(
                                                "Warning: Cleanup errors: {}",
                                                cleanup_errors.join(", ")
                                            ),
                                        )
                                        .await;
                                    } else {
                                        let _ = logger::append_log_entry(
                                            &app_handle_clone,
                                            &window_clone,
                                            &task.id,
                                            "metadata",
                                            "All temporary files cleaned up successfully",
                                        )
                                        .await;
                                    }
                                }
                                Err(e) => {
                                    // Translation failed catastrophically (even fallback failed)
                                    let _ = logger::append_log_entry(
                                        &app_handle_clone,
                                        &window_clone,
                                        &task.id,
                                        "error",
                                        &format!("Translation and fallback both failed: {}", e),
                                    )
                                    .await;

                                    // Keep temp files for debugging
                                    let _ = logger::append_log_entry(
                                        &app_handle_clone,
                                        &window_clone,
                                        &task.id,
                                        "metadata",
                                        &format!(
                                            "Keeping temp files for debugging: audio={}, srt={}",
                                            audio_path, original_srt_path
                                        ),
                                    )
                                    .await;

                                    let _ = window_clone.emit(
                                        "task:failed",
                                        TaskErrorPayload {
                                            task_id: task.id.clone(),
                                            error: format!("Translation failed: {}", e),
                                        },
                                    );
                                }
                            }
                        }
                        Err(e) => {
                            // Transcription failed: Keep temp audio file for debugging
                            let _ = logger::append_log_entry(
                                &app_handle_clone,
                                &window_clone,
                                &task.id,
                                "metadata",
                                &format!("Keeping temp audio file for debugging: {}", audio_path),
                            )
                            .await;

                            let _ = window_clone.emit(
                                "task:failed",
                                TaskErrorPayload {
                                    task_id: task.id.clone(),
                                    error: format!("Transcription failed: {}", e),
                                },
                            );
                        }
                    }
                }
                Err(e) => {
                    // Audio extraction failed
                    let _ = window_clone.emit(
                        "task:failed",
                        TaskErrorPayload {
                            task_id: task.id.clone(),
                            error: format!("Audio extraction failed: {}", e),
                        },
                    );
                }
            }

            // Release the permit
            drop(permit);
        });

        handles.push(handle);
    }

    // Wait for all tasks to complete
    for handle in handles {
        let _ = handle.await;
    }

    // Emit batch complete event
    let _ = window.emit("batch:complete", BatchCompletePayload {});

    Ok(())
}

#[tauri::command]
async fn translate_srt_batch(
    tasks: Vec<TaskInfo>,
    output_folder: String,
    target_language: String,
    translation_server_url: String,
    window: Window,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Process up to 4 tasks in parallel
    let mut handles = Vec::new();
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(4));

    for task in tasks {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        let window_clone = window.clone();
        let output_folder_clone = output_folder.clone();
        let app_handle_clone = app_handle.clone();
        let target_language_clone = target_language.clone();
        let translation_server_url_clone = translation_server_url.clone();

        let handle = tokio::spawn(async move {
            // Directly translate SRT (no audio extraction, no transcription)
            let translation_result = translation::translate_srt(
                &translation_server_url_clone,
                &task.id,
                &task.file_path, // SRT file path (not video)
                &target_language_clone,
                &output_folder_clone,
                &task.file_path, // Use same path for filename extraction
                true,            // SRT workflow: include language suffix
                &window_clone,
                &app_handle_clone,
            )
            .await;

            match translation_result {
                Ok(_final_srt_path) => {
                    // Success - translation complete event already emitted by translate_srt
                }
                Err(e) => {
                    let _ = window_clone.emit(
                        "task:failed",
                        TaskErrorPayload {
                            task_id: task.id.clone(),
                            error: format!("Translation failed: {}", e),
                        },
                    );
                }
            }

            // Release the permit
            drop(permit);
        });

        handles.push(handle);
    }

    // Wait for all tasks to complete
    for handle in handles {
        let _ = handle.await;
    }

    // Emit batch complete event
    let _ = window.emit("batch:complete", BatchCompletePayload {});

    Ok(())
}

#[tauri::command]
async fn cancel_extraction(task_id: String, window: Window) -> Result<(), String> {
    // Note: Full cancellation implementation requires architectural changes:
    // - Global state to track running FFmpeg processes and AssemblyAI operations
    // - CancellationToken propagation through async functions
    // - Process termination for FFmpeg
    // - Cleanup of temporary files
    //
    // For now, this logs the cancellation request. Tasks will complete normally.

    let _ = window.emit(
        "task:failed",
        TaskErrorPayload {
            task_id: task_id.clone(),
            error: "Task cancellation requested (Note: Cancellation not fully implemented - task may complete)".to_string(),
        },
    );

    Ok(())
}

#[tauri::command]
async fn get_task_logs(
    task_id: String,
    app_handle: tauri::AppHandle,
) -> Result<Vec<logger::LogEntry>, String> {
    logger::read_task_logs(&app_handle, &task_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_log_folder(app_handle: tauri::AppHandle) -> Result<String, String> {
    let logs_dir = logger::get_logs_dir(&app_handle)
        .await
        .map_err(|e| e.to_string())?;

    logs_dir
        .to_str()
        .ok_or_else(|| "Invalid log folder path".to_string())
        .map(|s| s.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            extract_audio_batch,
            translate_srt_batch,
            cancel_extraction,
            get_task_logs,
            get_log_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
