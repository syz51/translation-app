# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a video transcription and subtitle translation app built with TanStack Router (React SPA) for the frontend and Tauri v2 for the desktop application wrapper. The project uses TypeScript, Tailwind CSS v4, and Vite as the build tool.

**Two Main Workflows:**

1. **Video Transcription & Translation:** Video → Audio → Transcript → Translated SRT
2. **Direct SRT Translation:** Existing SRT → Translated SRT

Users select their workflow from a landing page (`/`) which routes to either `/video` or `/srt`.

## Architecture

**Desktop SPA Application:**

- Frontend: TanStack Router (React SPA) with file-based routing
- Desktop Wrapper: Tauri v2 (Rust-based) for native desktop capabilities
- The Vite dev server runs on port 1420 (configured in `tauri.conf.json` and `vite.config.ts`)
- Frontend builds output to `dist/` directory (consumed by Tauri)

**Key Stack Components:**

- TanStack Router: File-based routing in `src/routes/` directory with auto code-splitting
- React 19 with React Compiler (babel-plugin-react-compiler)
- Tailwind CSS v4 with Vite plugin
- T3 Env: Type-safe environment variables (see `src/env.ts`)
- Shadcn UI: Component library (install with `pnpx shadcn@latest add <component>`)

**Project Structure:**

- `index.html`: HTML entry point
- `src/main.tsx`: React application entry point
- `src/routes/`: File-based routing (auto-generates `src/routeTree.gen.ts`)
  - `src/routes/__root.tsx`: Root layout with router outlet and devtools
  - `src/routes/index.tsx`: Landing page with workflow selection cards
  - `src/routes/video.tsx`: Video transcription & translation workflow
  - `src/routes/srt.tsx`: Direct SRT translation workflow
  - `src/routes/task.$taskId.tsx`: Task detail view with logs
- `src/router.tsx`: Router configuration
- `src/env.ts`: Environment variable schema with Zod validation (includes translation server URL)
- `src/lib/utils.ts`: Shared utility functions
- `src/components/`: UI components (Shadcn-based)
  - `file-selector.tsx`: Video file picker
  - `srt-file-selector.tsx`: SRT file picker with drag-drop support
  - `language-selector.tsx`: Target language dropdown (en/zh)
  - `output-folder-selector.tsx`: Output folder picker
  - `progress-summary.tsx`: Dynamic batch progress (adapts to workflow)
  - `task-item.tsx`: Individual task status display
  - `task-list.tsx`: List of all tasks
  - `log-viewer.tsx`: Real-time log display with color coding
- `src/context/extraction-context.tsx`: Global state management (Context + Reducer)
- `src/hooks/`: Tauri command and event hooks
  - `use-extraction-commands.ts`: Video workflow commands
  - `use-srt-translation-commands.ts`: SRT workflow commands
  - `use-extraction-events.ts`: Event listeners for both workflows
- `src/types/extraction.ts`: TypeScript type definitions
- `src-tauri/`: Rust/Tauri backend code
  - `src-tauri/src/lib.rs`: Main entry point with command handlers
  - `src-tauri/src/ffmpeg.rs`: FFmpeg audio extraction
  - `src-tauri/src/assemblyai.rs`: AssemblyAI transcription API
  - `src-tauri/src/translation.rs`: Translation server integration
  - `src-tauri/src/logger.rs`: Structured JSON logging system
  - `src-tauri/tauri.conf.json`: Tauri configuration

**Tauri Integration:**

- Dev mode: Tauri runs `pnpm dev` (starts Vite) and connects to localhost:1420
- Build mode: Tauri runs `pnpm build` then packages the `dist/` directory
- The app uses `@tauri-apps/api` and `@tauri-apps/plugin-opener` for native functionality

## Development Commands

**Package Manager:** This project uses `pnpm`

**Development:**

```bash
# Start web dev server only (without Tauri)
pnpm dev

# Start Tauri desktop app in dev mode (starts Vite automatically)
pnpm tauri dev
```

**Building:**

```bash
# Build frontend for production
pnpm build

# Build Tauri desktop app (includes frontend build)
pnpm tauri build

# Preview production build
pnpm serve
```

**Testing:**

```bash
# Run all tests
pnpm test

# Run tests in watch mode (Vitest)
vitest
```

**Code Quality:**

```bash
# Run ESLint
pnpm lint

# Run Prettier
pnpm format

# Run both Prettier and ESLint with auto-fix
pnpm check
```

**UI Components:**

```bash
# Add Shadcn components (always use latest version)
pnpx shadcn@latest add <component-name>
```

## Important Configuration Details

**Path Aliases:**

- `@/*` maps to `./src/*` (configured in `tsconfig.json` and enabled via `vite-tsconfig-paths`)

**Environment Variables:**

- All client-side vars must be prefixed with `VITE_`
- All env vars are validated via Zod schemas in `src/env.ts`
- Import with: `import { env } from '@/env'`
- Required: `VITE_ASSEMBLYAI_API_KEY` (AssemblyAI API key)
- Required: `VITE_TRANSLATION_SERVER_URL` (default: `http://localhost:8000`)

**TanStack Router:**

- File-based routing: adding files to `src/routes/` auto-generates routes
- `routeTree.gen.ts` is auto-generated - don't edit manually
- Root layout lives in `src/routes/__root.tsx`
- Use `<Link to="/path">` from `@tanstack/react-router` for SPA navigation

**Tailwind CSS:**

- Version 4.x with Vite plugin
- Includes `prettier-plugin-tailwindcss` for class sorting
- Uses `tw-animate-css` for animations
- Uses `class-variance-authority` and `tailwind-merge` (via `src/lib/utils.ts`)

**React Compiler:**

- React 19 with experimental React Compiler enabled
- Compiler runs via `babel-plugin-react-compiler` in Vite config

## Pipeline Workflows

The app supports two distinct workflows selected from the landing page:

### Workflow 1: Video Transcription & Translation

Complete pipeline: Video → Audio → Transcript → Translation → Final SRT

1. **User selects video files, output folder, and target language**
   - Frontend file picker dialog (`file-selector.tsx`)
   - Language selector dropdown (`language-selector.tsx`) - English or Chinese
   - Validates video format (MP4, AVI, MKV, MOV, etc.)
   - Stores output folder and language preference in context

2. **FFmpeg extracts audio to WAV**
   - Converts video audio track to 16kHz mono WAV
   - Optimized for speech recognition
   - Saves to temp directory: `{system_temp}/translation-app-audio/`
   - Emits `task:started` event

3. **Upload WAV to AssemblyAI**
   - Uploads to EU endpoint (GDPR compliant)
   - Receives upload URL for transcription
   - Emits `transcription:started` event

4. **Poll for transcription completion**
   - Polls every 3 seconds
   - Max 30 minutes timeout (600 attempts)
   - Automatic retry with exponential backoff on network errors (3 attempts, 1s → 2s → 4s)
   - Emits `transcription:polling` events with status updates

5. **Download original SRT to temp folder**
   - Downloads completed transcript
   - Saves to temp directory with `-original.srt` suffix
   - Emits `transcription:complete` event
   - This SRT is intermediate, not the final output

6. **Translate SRT via translation server**
   - Sends SRT content to translation server (`POST /translate`)
   - Target language: user-selected (en/zh)
   - Source language: auto-detected server-side
   - Retry logic: 3 attempts with exponential backoff (1s → 2s → 4s)
   - **Fallback:** If translation fails after retries, copies original SRT to output folder
   - Emits `translation:started` and `translation:complete` events

7. **Save final translated SRT**
   - Saves to user's chosen output folder
   - Filename format: `{video_name}_{target_lang}.srt`
   - Example: `video.mp4` → `video_zh.srt`

8. **Cleanup temporary files**
   - Deletes temp WAV and temp `-original.srt` on success
   - Preserves temp files on failure (for debugging)
   - Emits `batch:complete` when all tasks finish

### Workflow 2: Direct SRT Translation

Simplified pipeline: Existing SRT → Translation → Translated SRT

1. **User selects SRT files, target language, and output folder**
   - SRT file picker with drag-drop support (`srt-file-selector.tsx`)
   - Language selector (`language-selector.tsx`)
   - Output folder selector

2. **Translate SRT**
   - Reads existing SRT file content
   - Sends to translation server (same logic as video workflow)
   - Retry with exponential backoff
   - Fallback to original on failure

3. **Save translated SRT**
   - Saves to output folder with `_{target_lang}.srt` suffix
   - Example: `subtitle.srt` → `subtitle_en.srt`
   - Original file unchanged

4. **No cleanup needed**
   - No temp files created
   - Emits `batch:complete` when all tasks finish

### Key Files

**Backend (Rust):**

- `src-tauri/src/lib.rs` - Main pipeline orchestration
  - `extract_audio_batch()` - Video workflow command (FFmpeg → AssemblyAI → Translation)
  - `translate_srt_batch()` - Direct SRT translation command
  - `get_task_logs()` - Fetch logs for task detail view
  - `get_log_folder()` - Get logs directory path
  - `cancel_extraction()` - Placeholder for task cancellation (not fully implemented)
  - Spawns parallel tasks (max 4 concurrent via semaphore)

- `src-tauri/src/ffmpeg.rs` - Audio extraction logic
  - `extract_audio_to_wav()` function
  - Spawns FFmpeg process with stdout/stderr capture
  - Emits `task:started` event
  - Creates temp WAV in `{system_temp}/translation-app-audio/`

- `src-tauri/src/assemblyai.rs` - Transcription API integration
  - `transcribe_audio()` - Main orchestration function
  - `upload_audio()` - Uploads WAV file
  - `create_transcript()` - Submits transcription request
  - `poll_transcript_status()` - Polls until complete
  - `download_srt()` - Downloads subtitle file to temp folder with `-original.srt` suffix
  - `retry_with_backoff()` - Network retry helper (3 attempts, exponential backoff)
  - Emits `transcription:started`, `transcription:polling`, `transcription:complete` events

- `src-tauri/src/translation.rs` - Translation server integration
  - `translate_srt()` - Main translation function
  - Reads SRT content, sends to translation server
  - Target language: user-selected (en/zh)
  - Source language: auto-detected server-side
  - **Fallback logic:** Copies original SRT to output on translation failure
  - `retry_with_backoff()` - Network retry helper (3 attempts, 1s → 2s → 4s)
  - Emits `translation:started`, `translation:complete` events
  - Output filename: `{original_name}_{target_lang}.srt`

- `src-tauri/src/logger.rs` - Structured logging system
  - Creates JSON log files per task
  - Stores in app data directory
  - Supports log types: `metadata`, `ffmpeg`, `ffprobe`, `assemblyai`, `translation`, `error`

**Frontend (React/TypeScript):**

- `src/routes/index.tsx` - Landing page
  - Two workflow selection cards (Video / SRT)
  - Routes to `/video` or `/srt`

- `src/routes/video.tsx` - Video transcription workflow page
  - File selector, output folder, language selector, progress summary, task list

- `src/routes/srt.tsx` - Direct SRT translation workflow page
  - SRT file selector, language selector, output folder, progress summary, task list

- `src/routes/task.$taskId.tsx` - Task detail view
  - Real-time log viewer for individual task
  - Fetches logs via `get_task_logs()` command

- `src/types/extraction.ts` - Type definitions
  - `TaskStatus`: `pending` | `processing` | `transcribing` | `translating` | `completed` | `failed`
  - `LogType`: `metadata` | `ffmpeg` | `ffprobe` | `assemblyai` | `translation` | `error`
  - Event payload types for all Rust → Frontend events
  - `ExtractionTask` includes `targetLanguage` field

- `src/context/extraction-context.tsx` - State management
  - React Context + Reducer pattern
  - Handles all task state transitions for both workflows
  - Actions: `TASK_STARTED`, `TASK_TRANSCRIBING`, `TASK_TRANSLATING`, `TRANSLATION_COMPLETE`, etc.
  - Stores `targetLanguage` in state

- `src/hooks/use-extraction-events.ts` - Event listeners
  - Listens to Rust events: `task:started`, `task:completed`, `task:failed`
  - Listens to AssemblyAI events: `transcription:started`, `transcription:polling`, `transcription:complete`
  - Listens to translation events: `translation:started`, `translation:complete`
  - Dispatches actions to context reducer

- `src/hooks/use-extraction-commands.ts` - Video workflow Tauri commands
  - `startExtraction()` - Invokes `extract_audio_batch` command
  - Passes AssemblyAI API key, target language, translation server URL

- `src/hooks/use-srt-translation-commands.ts` - SRT workflow Tauri commands
  - `selectSrtFiles()` - Opens SRT file picker dialog
  - `startTranslation()` - Invokes `translate_srt_batch` command
  - Passes target language and translation server URL

- `src/components/file-selector.tsx` - Video file picker
  - Multi-select video files
  - Validates video formats

- `src/components/srt-file-selector.tsx` - SRT file picker
  - Drag-drop support
  - Multi-select SRT files

- `src/components/language-selector.tsx` - Target language dropdown
  - English or Chinese
  - Updates context state

- `src/components/task-item.tsx` - Individual task UI
  - Shows status badge (color-coded by status)
  - Displays file path and output path
  - Disables actions during processing/transcribing/translating
  - Shows target language badge

- `src/components/progress-summary.tsx` - Batch progress
  - **Dynamic:** Adapts to current workflow (video or SRT)
  - Shows separate counts: Pending, Extracting, Transcribing, Translating, Completed, Failed
  - Button text changes based on workflow
  - Displays target language

- `src/components/log-viewer.tsx` - Real-time log display
  - Color-coded logs by type (translation = orange)
  - Auto-scroll with manual override
  - Formats timestamps

### Configuration Details

**AssemblyAI Endpoint:**

```rust
const ASSEMBLYAI_API_BASE: &str = "https://api.eu.assemblyai.com";
```

**Polling Configuration:**

```rust
const POLL_INTERVAL_SECS: u64 = 3;           // Poll every 3 seconds
const MAX_POLL_ATTEMPTS: u32 = 600;          // 30 minutes max
```

**Retry Configuration (both AssemblyAI and Translation):**

```rust
const MAX_RETRIES: u32 = 3;                  // 3 attempts
const INITIAL_RETRY_DELAY_MS: u64 = 1000;   // 1s → 2s → 4s (exponential)
```

**FFmpeg Settings:**

```rust
.arg("-ar").arg("16000")   // 16kHz sample rate
.arg("-ac").arg("1")        // Mono (1 channel)
.arg("-acodec").arg("pcm_s16le")  // PCM 16-bit
```

**Translation Server API:**

- Endpoint: `POST {VITE_TRANSLATION_SERVER_URL}/translate`
- Default URL: `http://localhost:8000`
- Request body:

  ```json
  {
    "srt_content": "string",
    "target_language": "en" | "zh",
    "source_language": null,  // auto-detected
    "country": null,
    "model": null
  }
  ```

- Response:

  ```json
  {
    "translated_srt": "string",
    "entry_count": number
  }
  ```

**Supported Languages:**

- `en` - English
- `zh` - Chinese

To add more languages:

1. Update `LANGUAGES` array in `src/components/language-selector.tsx`
2. Ensure translation server supports the language code

**Parallel Processing:**

```rust
let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(4));
```

Max 4 concurrent tasks for both video and SRT workflows.

### Event Flow

#### Video Workflow Event Flow

```
User clicks "Start Extraction, Transcription & Translation"
  → Frontend: dispatch({ type: 'START_PROCESSING' })
  → Frontend: invoke('extract_audio_batch', { tasks, outputFolder, apiKey, targetLanguage, translationServerUrl })

Backend spawns task (up to 4 parallel)
  → Rust: extract_audio_to_wav()
    → emit('task:started', { taskId })
    → emit('task:log', { type: 'ffmpeg', message })
  
  → Rust: transcribe_audio()
    → emit('transcription:started', { taskId })
    → emit('task:log', { type: 'assemblyai', message })
    → emit('transcription:polling', { taskId, status })
    → emit('transcription:complete', { taskId, audioPath, transcriptPath })
  
  → Rust: translate_srt()
    → emit('translation:started', { taskId, originalSrtPath })
    → emit('task:log', { type: 'translation', message })
    → emit('translation:complete', { taskId, translatedSrtPath })

Frontend receives events
  → dispatch({ type: 'TASK_STARTED', taskId })
  → dispatch({ type: 'TASK_TRANSCRIBING', taskId })
  → dispatch({ type: 'TASK_TRANSLATING', taskId })
  → dispatch({ type: 'ADD_LOG_ENTRY', taskId, logEntry })
  → dispatch({ type: 'TRANSLATION_COMPLETE', taskId, translatedPath })

All tasks complete
  → Rust: emit('batch:complete')
  → Frontend: dispatch({ type: 'STOP_PROCESSING' })
```

#### SRT Workflow Event Flow

```
User clicks "Start Translation"
  → Frontend: dispatch({ type: 'START_PROCESSING' })
  → Frontend: invoke('translate_srt_batch', { tasks, outputFolder, targetLanguage, translationServerUrl })

Backend spawns task (up to 4 parallel)
  → Rust: translate_srt()
    → emit('translation:started', { taskId, originalSrtPath })
    → emit('task:log', { type: 'translation', message })
    → emit('translation:complete', { taskId, translatedSrtPath })

Frontend receives events
  → dispatch({ type: 'TASK_TRANSLATING', taskId })
  → dispatch({ type: 'ADD_LOG_ENTRY', taskId, logEntry })
  → dispatch({ type: 'TRANSLATION_COMPLETE', taskId, translatedPath })

All tasks complete
  → Rust: emit('batch:complete')
  → Frontend: dispatch({ type: 'STOP_PROCESSING' })
```

### Error Handling

- **Network failures:** Automatic retry with exponential backoff (1s, 2s, 4s) for both AssemblyAI and translation
- **API errors:** Parsed for user-friendly messages (invalid key, rate limit, etc.)
- **FFmpeg failures:** Emits `task:failed` with FFmpeg stderr output
- **Transcription errors:** Preserves temp audio file for debugging
- **Translation failures:**
  - Retries 3 times with exponential backoff
  - **Fallback:** Copies original SRT to output folder if all retries fail
  - Task still succeeds (user gets untranslated SRT)
  - Logs indicate fallback occurred
- **Temp file cleanup:** Only cleans up on full success; preserves on any failure for debugging

### Testing Considerations

When testing the video workflow:

1. **Happy path:** Single video, verify translated SRT with `_{lang}.srt` suffix
2. **Batch processing:** 3-4 videos, verify parallel execution (max 4 concurrent)
3. **Invalid API key:** Test with wrong key, verify user-friendly error
4. **Network failure:** Disconnect during upload, verify retry logic
5. **Long video:** Test 10+ min video, verify doesn't timeout
6. **Special chars:** Test filenames with unicode/special characters
7. **No audio:** Video without audio track, verify graceful failure
8. **Translation server down:** Verify fallback to original SRT
9. **Both languages:** Test both English and Chinese target languages

When testing the SRT workflow:

1. **Happy path:** Single SRT, verify translated output with `_{lang}.srt` suffix
2. **Batch processing:** Multiple SRTs, verify parallel execution
3. **Translation server down:** Verify fallback to original SRT
4. **Large SRT files:** Test with 1000+ subtitle entries
5. **Special chars:** Test SRT filenames with unicode/special characters
6. **Both languages:** Test both English and Chinese target languages
7. **Drag-drop:** Verify drag-drop functionality in SRT file selector

## Cursor Rules

When adding Shadcn components, always use the latest version:

```bash
pnpx shadcn@latest add <component-name>
```
