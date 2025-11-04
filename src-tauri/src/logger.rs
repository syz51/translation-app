#![allow(dead_code)]

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, Window};
use tokio::fs::{self, OpenOptions};
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    #[serde(rename = "type")]
    pub log_type: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskLogPayload {
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub timestamp: String,
    #[serde(rename = "type")]
    pub log_type: String,
    pub message: String,
}

/// Get the logs directory path
pub async fn get_logs_dir(app_handle: &AppHandle) -> Result<PathBuf> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .context("Failed to get app data directory")?;

    let logs_dir = app_data_dir.join("logs");

    // Create logs directory if it doesn't exist
    if !logs_dir.exists() {
        fs::create_dir_all(&logs_dir)
            .await
            .context("Failed to create logs directory")?;
    }

    Ok(logs_dir)
}

/// Get the log file path for a specific task
pub async fn get_task_log_path(app_handle: &AppHandle, task_id: &str) -> Result<PathBuf> {
    let logs_dir = get_logs_dir(app_handle).await?;
    Ok(logs_dir.join(format!("{}.log", task_id)))
}

/// Initialize a log file for a task
pub async fn init_task_log(app_handle: &AppHandle, task_id: &str) -> Result<()> {
    let log_path = get_task_log_path(app_handle, task_id).await?;

    // Create the file if it doesn't exist
    OpenOptions::new()
        .create(true)
        .write(true)
        .append(true)
        .open(&log_path)
        .await
        .context("Failed to create log file")?;

    Ok(())
}

/// Append a log entry to a task's log file and emit event
pub async fn append_log_entry(
    app_handle: &AppHandle,
    window: &Window,
    task_id: &str,
    log_type: &str,
    message: &str,
) -> Result<()> {
    let timestamp = chrono::Utc::now().to_rfc3339();

    let log_entry = LogEntry {
        timestamp: timestamp.clone(),
        log_type: log_type.to_string(),
        message: message.to_string(),
    };

    // Serialize to JSON line
    let json_line = serde_json::to_string(&log_entry).context("Failed to serialize log entry")?;
    let log_line = format!("{}\n", json_line);

    // Write to file
    let log_path = get_task_log_path(app_handle, task_id).await?;
    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .append(true)
        .open(&log_path)
        .await
        .context("Failed to open log file")?;

    file.write_all(log_line.as_bytes())
        .await
        .context("Failed to write to log file")?;

    file.flush().await.context("Failed to flush log file")?;

    // Emit event to frontend
    let _ = window.emit(
        "task:log",
        TaskLogPayload {
            task_id: task_id.to_string(),
            timestamp,
            log_type: log_type.to_string(),
            message: message.to_string(),
        },
    );

    Ok(())
}

/// Read all log entries for a task
pub async fn read_task_logs(app_handle: &AppHandle, task_id: &str) -> Result<Vec<LogEntry>> {
    let log_path = get_task_log_path(app_handle, task_id).await?;

    // Check if log file exists
    if !log_path.exists() {
        return Ok(Vec::new());
    }

    // Read the entire file
    let content = fs::read_to_string(&log_path)
        .await
        .context("Failed to read log file")?;

    // Parse each line as a JSON log entry
    let mut entries = Vec::new();
    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }

        match serde_json::from_str::<LogEntry>(line) {
            Ok(entry) => entries.push(entry),
            Err(e) => {
                eprintln!("Failed to parse log line: {} - Error: {}", line, e);
            }
        }
    }

    Ok(entries)
}
