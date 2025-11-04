# Manual Testing Guide - Phase 4

This document outlines the manual testing scenarios for the AssemblyAI transcription integration.

## Prerequisites

1. Build and run the app: `pnpm tauri dev`
2. Have a valid AssemblyAI API key in `.env`
3. Prepare test video files:
   - Short video (30-60 seconds)
   - Long video (10+ minutes)
   - Video with special characters in filename (e.g., `test-日本語-€.mp4`)
   - Very short video (<5 seconds)
   - Corrupt video file
   - Video without audio track

## Test Scenarios

### ✅ Happy Path Tests

#### 1. Single Video Transcription

**Steps:**

1. Click "Add Videos"
2. Select a single 30-60 second video file
3. Click "Select Output Folder" and choose a folder
4. Click "Start Extraction & Transcription"

**Expected Results:**

- Status changes: pending → processing → transcribing → completed
- Progress summary shows accurate counts
- Logs display with proper color coding:
  - Blue = metadata/info
  - Green = FFmpeg
  - Orange = AssemblyAI
  - Red = errors
- SRT file is created in output folder
- SRT file has correct timing and transcription
- Temporary audio file is cleaned up
- Duration is displayed

#### 2. Batch Processing (3-4 Videos)

**Steps:**

1. Click "Add Videos"
2. Select 3-4 video files
3. Select output folder
4. Click "Start Extraction & Transcription"

**Expected Results:**

- Multiple tasks process in parallel (max 4 concurrent)
- Each task shows independent progress
- All SRT files are created
- No filename collisions
- All temp files cleaned up after completion

### ❌ Error Scenario Tests

#### 3. Invalid API Key

**Steps:**

1. Change `.env` to have an invalid API key
2. Restart the app
3. Add a video and start processing

**Expected Results:**

- Task fails with clear error message
- Error message mentions "Invalid API key" or "check your AssemblyAI API key"
- Temporary audio file is preserved for debugging
- UI shows task as "Failed" with red badge

#### 4. Network Failure

**Steps:**

1. Add a video and start processing
2. Disconnect network during upload phase (watch logs)
3. Reconnect network

**Expected Results:**

- Logs show retry attempts: "Upload audio failed (attempt 1/3), retrying in 1000ms..."
- Automatic retry with exponential backoff (1s → 2s → 4s)
- Task eventually succeeds after network is restored
- OR task fails after 3 attempts with clear error message

#### 5. Corrupt Video File

**Steps:**

1. Create a corrupt video file (e.g., rename .txt to .mp4)
2. Add the file and start processing

**Expected Results:**

- FFmpeg fails during audio extraction
- Error shows in logs with FFmpeg stderr output
- Task marked as failed
- No SRT file created
- Other tasks in batch continue processing

#### 6. Video with No Audio Track

**Steps:**

1. Use a video file with no audio track (or silent video)
2. Start processing

**Expected Results:**

- Either FFmpeg fails during extraction with clear error
- OR extraction succeeds but produces empty/silent WAV
- AssemblyAI may fail or return empty transcript
- Clear error message displayed

### 🔍 Edge Case Tests

#### 7. Long Video (10+ minutes)

**Steps:**

1. Use a video that's 10+ minutes long
2. Start processing

**Expected Results:**

- Transcription completes without timeout
- Polling continues (max 30 minutes = 600 attempts)
- Logs show regular polling: "Poll attempt N: Status = processing"
- SRT file generated with correct timing throughout

#### 8. Special Characters in Filename

**Steps:**

1. Use video with unicode/special characters: `test-日本語-€uro-file.mp4`
2. Start processing

**Expected Results:**

- File name handled correctly
- SRT saved with same base name: `test-日本語-€uro-file.srt`
- No encoding errors
- File opens correctly

#### 9. Very Short Video (<5 seconds)

**Steps:**

1. Use a very short video clip (2-5 seconds)
2. Start processing

**Expected Results:**

- Processing completes successfully
- SRT file generated (may be short/minimal)
- No timeout or errors
- Duration displayed correctly

### 🎨 UI Flow Tests

#### 10. Status Badge Transitions

**Watch for:**

- Pending: Gray badge with clock icon
- Processing (Extracting Audio): Blue badge with spinning loader
- Transcribing: Purple badge with spinning loader
- Completed: Green badge with checkmark
- Failed: Red badge with X icon

#### 11. Progress Summary Counts

**Verify:**

- Pending count decreases as tasks start
- Extracting count increases when audio extraction starts
- Transcribing count increases when AssemblyAI starts
- Completed count increases when tasks finish
- Failed count increases on errors
- Total always equals sum of all statuses

#### 12. View Details Navigation

**Steps:**

1. Add and start processing a task
2. Click the eye icon "View Details" button

**Expected Results:**

- Navigates to task detail page (`/task/{taskId}`)
- Shows all logs for that task
- Logs are color-coded correctly
- Timestamps are formatted
- Auto-scroll works (scrolls to bottom on new entries)
- Manual scroll override works (stops auto-scroll when scrolling up)
- "Scroll to bottom" button appears when scrolled up

#### 13. Remove Task Disabled During Processing

**Steps:**

1. Add a task and start processing
2. Try to click "Remove Task" (trash icon)

**Expected Results:**

- Remove button is disabled during "processing" status
- Remove button is disabled during "transcribing" status
- Remove button is enabled for pending/completed/failed tasks
- Button appears on hover

#### 14. Clear Completed Works

**Steps:**

1. Complete several tasks
2. Click "Clear Completed" button

**Expected Results:**

- Only completed tasks are removed
- Failed tasks remain
- Processing/transcribing tasks remain
- Button is disabled during processing

### 🔧 System Tests

#### 15. Temp File Cleanup

**Steps:**

1. Complete a successful transcription
2. Check temp directory: `{system_temp}/translation-app-audio/`

**Expected Results:**

- Temp audio file (`{taskId}_{filename}.wav`) is deleted
- Logs show: "Temporary audio file cleaned up successfully"

**On Failure:**

- Temp audio file is preserved
- Logs show: "Keeping temp audio file for debugging: {path}"

#### 16. Logs Folder Location

**Steps:**

1. Click a task's "View Details"
2. Check app data directory for logs

**Expected Results:**

- Logs stored in JSON format
- One file per task: `{taskId}.json`
- Logs persist after app restart
- Can be opened and read

#### 17. No Console Errors

**Steps:**

1. Open browser DevTools (if in dev mode)
2. Run through any test scenario

**Expected Results:**

- No JavaScript errors in console
- Only expected console.log messages
- No unhandled promise rejections

## Test Results Checklist

Use this to track your testing progress:

### Functional Tests

- [ ] Single video transcription completes successfully
- [ ] Batch processing (3-4 videos) works in parallel
- [ ] Invalid API key shows clear error
- [ ] Network failure handled gracefully (retry or clear error)
- [ ] Corrupt video fails gracefully without crashing
- [ ] Video with no audio shows appropriate error
- [ ] Long video (10+ min) completes without timeout
- [ ] Special characters in filenames work
- [ ] Very short video (<5s) transcribes correctly

### UI Tests

- [ ] Status badges update correctly through all states
- [ ] Progress summary counts accurate throughout
- [ ] AssemblyAI logs display with orange color
- [ ] View Details navigates to correct task
- [ ] Remove Task disabled during processing/transcribing
- [ ] Clear Completed only removes completed tasks

### System Tests

- [ ] Temp audio files cleaned up after success
- [ ] Temp audio files preserved after failure
- [ ] No console errors during normal operation
- [ ] Logs persist and can be viewed

## Production Build Testing

After all manual tests pass in dev mode:

```bash
# Build production version
pnpm tauri build

# Test the built application
# Location: src-tauri/target/release/bundle/
```

**Verify:**

- [ ] Application launches correctly
- [ ] FFmpeg binaries are bundled and work
- [ ] All features work same as dev mode
- [ ] No errors in production

## Notes for Testers

- Keep your AssemblyAI API key private
- Monitor AssemblyAI usage/credits during testing
- Temporary files location varies by OS:
  - Windows: `%TEMP%\translation-app-audio\`
  - macOS: `/tmp/translation-app-audio/`
  - Linux: `/tmp/translation-app-audio/`
- If testing shows issues, check logs in app data directory
- Network retry logs help diagnose connection issues

## Reporting Issues

When reporting issues, include:

1. Operating system and version
2. Steps to reproduce
3. Expected vs actual behavior
4. Screenshots if applicable
5. Task logs (from View Details)
6. Console errors (if any)
