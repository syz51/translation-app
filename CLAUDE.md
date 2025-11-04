# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a translation app built with TanStack Router (React SPA) for the frontend and Tauri v2 for the desktop application wrapper. The project uses TypeScript, Tailwind CSS v4, and Vite as the build tool.

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
- `src/router.tsx`: Router configuration
- `src/env.ts`: Environment variable schema with Zod validation
- `src/lib/utils.ts`: Shared utility functions
- `src/components/`: UI components (currently empty - use Shadcn to add)
- `src-tauri/`: Rust/Tauri backend code
  - `src-tauri/src/main.rs`: Tauri application entry point
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

## Transcription Pipeline

The app follows an end-to-end video-to-transcript pipeline:

### Workflow Steps

1. **User selects video files and output folder**
   - Frontend file picker dialog
   - Validates video format (MP4, AVI, MKV, MOV, etc.)
   - Stores output folder preference

2. **FFmpeg extracts audio to WAV**
   - Converts video audio track to 16kHz mono WAV
   - Optimized for speech recognition
   - Saves to temporary directory

3. **Upload WAV to AssemblyAI**
   - Uploads to EU endpoint (GDPR compliant)
   - Receives upload URL for transcription

4. **Poll for transcription completion**
   - Polls every 3 seconds
   - Max 30 minutes timeout (600 attempts)
   - Automatic retry with exponential backoff on network errors

5. **Download and save SRT subtitle file**
   - Downloads completed transcript
   - Saves with original video filename + `.srt` extension
   - Saves to user's chosen output folder

6. **Cleanup temporary audio file**
   - Deletes temp WAV on success
   - Preserves temp file on failure (for debugging)

### Key Files

**Backend (Rust):**

- `src-tauri/src/lib.rs` - Main pipeline orchestration
  - `extract_audio_batch()` command handles batch processing
  - Spawns parallel tasks (max 4 concurrent)
  - Coordinates FFmpeg → AssemblyAI workflow

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
  - `download_srt()` - Downloads subtitle file
  - `retry_with_backoff()` - Network retry helper (3 attempts, exponential backoff)
  - Emits `transcription:started`, `transcription:polling`, `transcription:complete` events

- `src-tauri/src/logger.rs` - Structured logging system
  - Creates JSON log files per task
  - Stores in app data directory
  - Supports log types: `metadata`, `ffmpeg`, `ffprobe`, `assemblyai`, `error`

**Frontend (React/TypeScript):**

- `src/types/extraction.ts` - Type definitions
  - `TaskStatus`: `pending` | `processing` | `transcribing` | `completed` | `failed`
  - `LogType`: `metadata` | `ffmpeg` | `ffprobe` | `assemblyai` | `error`
  - Event payload types for all Rust → Frontend events

- `src/context/extraction-context.tsx` - State management
  - React Context + Reducer pattern
  - Handles all task state transitions
  - `TASK_STARTED`, `TASK_TRANSCRIBING`, `TASK_TRANSCRIPTION_COMPLETE` actions

- `src/hooks/use-extraction-events.ts` - Event listeners
  - Listens to Rust events: `task:started`, `task:completed`, `task:failed`
  - Listens to AssemblyAI events: `transcription:started`, `transcription:polling`, `transcription:complete`
  - Dispatches actions to context reducer

- `src/hooks/use-extraction-commands.ts` - Tauri commands
  - `startExtraction()` - Invokes `extract_audio_batch` command
  - `getTaskLogs()` - Fetches logs for task detail view
  - Passes AssemblyAI API key from environment

- `src/components/task-item.tsx` - Individual task UI
  - Shows status badge (color-coded by status)
  - Displays both audio path and transcript path
  - Disables actions during processing/transcribing

- `src/components/progress-summary.tsx` - Batch progress
  - Shows separate counts: Pending, Extracting, Transcribing, Completed, Failed
  - "Start Extraction & Transcription" button

- `src/components/log-viewer.tsx` - Real-time log display
  - Color-coded logs by type (AssemblyAI = orange)
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

**Retry Configuration:**

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

### Event Flow

```
User clicks "Start"
  → Frontend: dispatch({ type: 'START_PROCESSING' })
  → Frontend: invoke('extract_audio_batch', { tasks, outputFolder, apiKey })

Backend spawns task
  → Rust: extract_audio_to_wav()
    → emit('task:started', { taskId })
    → emit('task:log', { type: 'ffmpeg', message })
  → Rust: transcribe_audio()
    → emit('transcription:started', { taskId, transcriptId })
    → emit('task:log', { type: 'assemblyai', message })
    → emit('transcription:polling', { taskId, status })
    → emit('transcription:complete', { taskId, audioPath, transcriptPath })

Frontend receives events
  → dispatch({ type: 'TASK_STARTED', taskId })
  → dispatch({ type: 'TASK_TRANSCRIBING', taskId })
  → dispatch({ type: 'ADD_LOG_ENTRY', taskId, logEntry })
  → dispatch({ type: 'TASK_TRANSCRIPTION_COMPLETE', taskId, transcriptPath })

All tasks complete
  → Rust: emit('batch:complete')
  → Frontend: dispatch({ type: 'STOP_PROCESSING' })
```

### Error Handling

- **Network failures:** Automatic retry with exponential backoff (1s, 2s, 4s)
- **API errors:** Parsed for user-friendly messages (invalid key, rate limit, etc.)
- **FFmpeg failures:** Emits `task:failed` with FFmpeg stderr output
- **Transcription errors:** Preserves temp audio file for debugging

### Testing Considerations

When testing the transcription pipeline:

1. **Happy path:** Single video, verify SRT generated with correct timing
2. **Batch processing:** 3-4 videos, verify parallel execution (max 4 concurrent)
3. **Invalid API key:** Test with wrong key, verify user-friendly error
4. **Network failure:** Disconnect during upload, verify retry logic
5. **Long video:** Test 10+ min video, verify doesn't timeout
6. **Special chars:** Test filenames with unicode/special characters
7. **No audio:** Video without audio track, verify graceful failure

## Cursor Rules

When adding Shadcn components, always use the latest version:

```bash
pnpx shadcn@latest add <component-name>
```
