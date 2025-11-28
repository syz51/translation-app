# Architecture Decisions & Future Improvements

This document outlines architectural concerns identified during the app-redesign branch review. These are not bugs but design decisions that may warrant future enhancement based on product requirements.

---

## 1. Temp File Cleanup Strategy

### Current Behavior

Completed files are stored in `{system_temp}/translation-app-output/{task_id}/` indefinitely.

```
/var/folders/.../T/translation-app-output/
├── abc123-uuid/
│   └── video_zh.srt
├── def456-uuid/
│   └── another_en.srt
└── ... (accumulates over time)
```

### Concerns

- **Disk usage:** No automatic cleanup means temp folder grows unbounded
- **No cleanup on app exit:** Files persist across sessions
- **No TTL:** Old files never expire
- **No size limits:** No cap on total storage used

### Recommended Solutions

| Option                               | Pros                          | Cons                                    |
| ------------------------------------ | ----------------------------- | --------------------------------------- |
| **Cleanup on exit**                  | Simple, predictable           | Loses files if user forgets to download |
| **TTL-based cleanup** (e.g., 7 days) | Balances retention vs cleanup | Requires background scheduler           |
| **Manual cleanup** with storage UI   | User control                  | Requires settings UI work               |
| **Cleanup after download**           | Minimal storage               | Can't re-download                       |

### Implementation Notes

**Option A: Cleanup on exit**

```rust
// In lib.rs, add app lifecycle hook
.on_event(|app, event| {
    if let tauri::RunEvent::Exit = event {
        cleanup_temp_output_folder(app);
    }
})
```

**Option B: TTL-based cleanup**

```rust
// On app startup, delete files older than N days
async fn cleanup_old_temp_files(app: &AppHandle, max_age_days: u64) {
    let temp_dir = app.path().temp_dir().unwrap();
    let output_dir = temp_dir.join("translation-app-output");
    // Walk directory, check modified time, delete if > max_age_days
}
```

**Option C: Storage UI in settings**

- Show total temp storage used
- "Clear all temp files" button
- Per-task delete (already implemented via `delete_task_files`)

### Decision Required

- What's acceptable UX if user downloads file, then tries again later?
- Should we warn before clearing?
- Is 7-day TTL reasonable default?

---

## 2. Concurrent Task Feedback

### Current Behavior

Backend uses a semaphore limiting to 4 concurrent tasks:

```rust
let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(4));
```

Frontend allows unlimited task queuing with no feedback about queue position.

### Concerns

- User queues 10 tasks, sees 4 processing, 6 stuck in "pending"
- No explanation why tasks aren't starting
- No visibility into semaphore slot availability

### Recommended Solutions

| Option                                     | Complexity | UX Impact   |
| ------------------------------------------ | ---------- | ----------- |
| **Show queue position** ("3 tasks ahead")  | Medium     | High        |
| **Show slot usage** ("3/4 slots in use")   | Low        | Medium      |
| **Limit UI queuing** to match backend      | Low        | Restrictive |
| **Expand slots** based on system resources | High       | Transparent |

### Implementation Notes

**Option A: Queue position**

Requires tracking task order and semaphore state. Backend would emit:

```rust
#[derive(Serialize)]
struct QueueStatusPayload {
    active_count: u32,
    max_concurrent: u32,
    queue_position: u32, // 0 = running, 1+ = waiting
}
```

**Option B: Slot usage (simpler)**

Track active count in shared state:

```rust
static ACTIVE_TASKS: AtomicU32 = AtomicU32::new(0);

// On task start
ACTIVE_TASKS.fetch_add(1, Ordering::SeqCst);
window.emit("slots:update", SlotsPayload {
    active: ACTIVE_TASKS.load(Ordering::SeqCst),
    max: 4
});

// On task complete
ACTIVE_TASKS.fetch_sub(1, Ordering::SeqCst);
```

Frontend displays: `Processing: 3/4 slots`

### Decision Required

- Is queue visibility needed, or just slot count?
- Should we limit frontend queuing to prevent large backlogs?

---

## 3. Retry Mechanism

### Current Behavior

```typescript
// new-task.tsx
try {
  await startExtraction(tasks, ...)
  setSelectedFiles([]) // Clears selection
} catch (error) {
  alert(`Failed to start task: ${error}`)
  // Tasks were added to queue but files are cleared
}
```

If `startExtraction` throws (e.g., backend validation fails), tasks are added to queue but:

- Selected files are cleared
- No easy way to retry the same files
- User must re-select everything

### Concerns

- Poor UX on transient failures (network blip, backend restart)
- Lost work if user selected many files
- Tasks in queue have "pending" status but no way to trigger them

### Recommended Solutions

| Option                           | Complexity | UX Impact   |
| -------------------------------- | ---------- | ----------- |
| **Don't clear files on error**   | Trivial    | Good        |
| **Retry button on failed tasks** | Medium     | Best        |
| **Auto-retry with backoff**      | High       | Transparent |

### Implementation Notes

**Option A: Don't clear on error (quick fix)**

```typescript
try {
  await startExtraction(tasks, ...)
  setSelectedFiles([]) // Only clear on success
} catch (error) {
  alert(`Failed to start: ${error}`)
  // Don't clear files - user can retry
}
```

**Option B: Retry failed tasks**

Already have `RETRY_TASK` action - need to:

1. Store original task params (filePath, targetLanguage)
2. On retry, re-invoke appropriate backend command
3. Handle pending tasks that never started

```typescript
const handleRetry = async (task: ExtractionTask) => {
  dispatch({ type: 'RETRY_TASK', taskId: task.id })

  if (task.filePath.match(/\.srt$/i)) {
    await startTranslation([task], task.targetLanguage!, backendUrl)
  } else {
    await startExtraction([task], backendUrl, task.targetLanguage!)
  }
}
```

### Decision Required

- Should failed tasks auto-retry?
- How many retry attempts before giving up?
- Should we distinguish "never started" vs "failed mid-process"?

---

## 4. File Size Fetch Timing

### Current Behavior

```typescript
// task-queue-item.tsx
useEffect(() => {
  if (isCompleted) {
    invoke<number>('get_completed_file_size', { taskId: task.id })
      .then(setFileSize)
      .catch((error) => {
        console.error('Failed to get file size:', error)
        setFileSize(null) // Silent failure
      })
  }
}, [isCompleted, task.id])
```

### Concerns

- Race condition: File could be cleaned up between completion and size fetch
- Silent failure: User sees no size, no explanation
- Extra IPC call for every completed task

### Recommended Solutions

| Option                               | Complexity | Reliability |
| ------------------------------------ | ---------- | ----------- |
| **Include size in completion event** | Low        | High        |
| **Cache size in task state**         | Low        | Medium      |
| **Fetch on-demand with retry**       | Medium     | Medium      |

### Implementation Notes

**Option A: Include in completion event (recommended)**

Modify Rust to calculate size before emitting completion:

```rust
// translation.rs
let file_size = tokio::fs::metadata(&output_path).await?.len();

window.emit("translation:complete", TranslationCompletePayload {
    task_id: task_id.to_string(),
    translated_path: output_path.to_string(),
    file_size, // Add this field
})?;
```

Frontend stores size in task state:

```typescript
case 'TRANSLATION_COMPLETE':
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === action.taskId
        ? {
            ...task,
            status: 'completed',
            outputPath: action.translatedPath,
            fileSize: action.fileSize, // Store it
          }
        : task,
    ),
  }
```

### Decision Required

- Is file size display essential or nice-to-have?
- Should we show "Size unavailable" on fetch failure?

---

## 5. Backend URL Migration

### Change Summary

**Old configuration (two separate URLs):**

```bash
VITE_TRANSCRIPTION_SERVER_URL=http://localhost:3000/api
VITE_TRANSLATION_SERVER_URL=http://localhost:8000
```

**New configuration (single unified URL):**

```bash
VITE_BACKEND_URL=http://localhost:8000/api/v1
```

### Migration Impact

| Scenario                                    | Impact                                  |
| ------------------------------------------- | --------------------------------------- |
| New users                                   | None - uses default                     |
| Users with `.env` file                      | App may fail to connect if old vars set |
| Deployments with env vars                   | Must update configuration               |
| Separate transcription/translation services | No longer supported                     |

### Recommended Solutions

| Option                        | Effort | Flexibility |
| ----------------------------- | ------ | ----------- |
| **Document migration**        | Low    | Low         |
| **Support both (deprecated)** | Medium | High        |
| **Revert to separate URLs**   | Medium | High        |

### Implementation Notes

**Option A: Document only (current)**

Update README/CLAUDE.md with migration guide:

```markdown
## Migration from v1.x

If upgrading from a version with separate backend URLs:

1. Remove `VITE_TRANSCRIPTION_SERVER_URL` and `VITE_TRANSLATION_SERVER_URL`
2. Add `VITE_BACKEND_URL=http://your-unified-backend/api/v1`
```

**Option B: Support both (backwards compatible)**

```typescript
// env.ts
export const env = createEnv({
  client: {
    VITE_BACKEND_URL: z.url().optional(),
    // Deprecated - for backwards compatibility
    VITE_TRANSCRIPTION_SERVER_URL: z.url().optional(),
    VITE_TRANSLATION_SERVER_URL: z.url().optional(),
  },
})

// Resolve to single URL
export const backendUrl = env.VITE_BACKEND_URL
  ?? env.VITE_TRANSCRIPTION_SERVER_URL
  ?? 'http://localhost:8000/api/v1'
```

**Option C: Revert to separate URLs**

If services may be deployed separately in future, keep flexibility:

```typescript
VITE_TRANSCRIPTION_URL: z.url().default('http://localhost:8000/api/v1'),
VITE_TRANSLATION_URL: z.url().default('http://localhost:8000/api/v1'),
```

### Decision Required

- Will transcription and translation ever be separate services?
- How many existing deployments need migration support?
- Is backwards compatibility worth the complexity?

---

## Summary Matrix

| Concern             | Priority | Effort     | Recommendation                              |
| ------------------- | -------- | ---------- | ------------------------------------------- |
| Temp cleanup        | Medium   | Low-Medium | Implement cleanup on exit + optional manual |
| Concurrent feedback | Low      | Low        | Show slot usage (3/4)                       |
| Retry mechanism     | High     | Low        | Don't clear files on error                  |
| File size timing    | Low      | Low        | Include in completion event                 |
| URL migration       | Medium   | Low        | Document migration path                     |

---

## Next Steps

1. **Prioritize** based on user feedback and pain points
2. **Create issues** for items to implement
3. **Update this doc** as decisions are made
