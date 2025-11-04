mod assemblyai;
mod ffmpeg;
mod logger;

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
    api_key: String,
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
        let api_key_clone = api_key.clone();

        let handle = tokio::spawn(async move {
            // Step 1: Extract audio to temp directory
            let extraction_result =
                extract_audio_to_wav(&task.id, &task.file_path, &window_clone, &app_handle_clone)
                    .await;

            match extraction_result {
                Ok(audio_path) => {
                    // Step 2: Transcribe audio
                    let transcription_result = assemblyai::transcribe_audio(
                        &api_key_clone,
                        &task.id,
                        &audio_path,
                        &task.file_path,
                        &output_folder_clone,
                        &window_clone,
                        &app_handle_clone,
                    )
                    .await;

                    // Handle transcription result
                    match transcription_result {
                        Ok(_) => {
                            // Success: Clean up the temporary audio file
                            if let Err(e) = tokio::fs::remove_file(&audio_path).await {
                                // Log cleanup error but don't fail the task
                                let _ = logger::append_log_entry(
                                    &app_handle_clone,
                                    &window_clone,
                                    &task.id,
                                    "metadata",
                                    &format!("Warning: Failed to cleanup temp audio file: {}", e),
                                )
                                .await;
                            } else {
                                let _ = logger::append_log_entry(
                                    &app_handle_clone,
                                    &window_clone,
                                    &task.id,
                                    "metadata",
                                    "Temporary audio file cleaned up successfully",
                                )
                                .await;
                            }
                        }
                        Err(e) => {
                            // Transcription failed: Keep temp file for debugging
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
            cancel_extraction,
            get_task_logs,
            get_log_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
