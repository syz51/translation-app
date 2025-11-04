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

        let handle = tokio::spawn(async move {
            let result = extract_audio_to_wav(
                &task.id,
                &task.file_path,
                &output_folder_clone,
                &window_clone,
                &app_handle_clone,
            )
            .await;

            // Release the permit
            drop(permit);

            // Handle errors
            if let Err(e) = result {
                let _ = window_clone.emit(
                    "task:failed",
                    TaskErrorPayload {
                        task_id: task.id.clone(),
                        error: e.to_string(),
                    },
                );
            }
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
async fn cancel_extraction(_task_id: String) -> Result<(), String> {
    // TODO: Implement cancellation logic
    // This would require tracking running processes and killing them
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
