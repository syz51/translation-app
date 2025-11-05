# Translation App

A desktop application for video transcription and subtitle translation. Extract audio from videos, generate transcripts via AssemblyAI, and translate subtitles using a local translation server.

## Features

### Two Workflows

- **Video Transcription & Translation:** Complete pipeline from video → audio → transcript → translated SRT
- **Direct SRT Translation:** Translate existing SRT subtitle files without video processing

### Core Capabilities

- **Audio Extraction:** High-quality WAV extraction from video files using FFmpeg
- **Automatic Transcription:** Generate SRT subtitles using AssemblyAI's speech recognition API
- **SRT Translation:** Translate subtitles via local translation server with fallback to original
- **Batch Processing:** Process up to 4 files in parallel for maximum efficiency
- **Real-time Logging:** Monitor FFmpeg, AssemblyAI, and translation progress with detailed logs
- **Language Support:** English and Chinese translation (extensible)
- **Network Resilience:** Automatic retry with exponential backoff for network failures
- **Cross-platform:** Works on Windows, macOS, and Linux

## Prerequisites

1. **Rust:** Install the Rust toolchain from [rustup.rs](https://rustup.rs/)
1. **Node.js & pnpm:** Install [pnpm](https://pnpm.io/) package manager
1. **AssemblyAI API Key:** Get your free API key from [AssemblyAI](https://www.assemblyai.com/)
1. **Translation Server:** Local translation server (defaults to `http://localhost:8000`)

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd translation-app
```

2. Install dependencies:

```bash
pnpm install
```

3. Create a `.env` file in the project root:

```env
VITE_ASSEMBLYAI_API_KEY=your_api_key_here
VITE_TRANSLATION_SERVER_URL=http://localhost:8000
```

Get your AssemblyAI API key from [https://www.assemblyai.com/](https://www.assemblyai.com/)

## Running the App

### Development Mode

Start the app with hot-reload for development:

```bash
pnpm tauri dev
```

This will:

- Start the Vite dev server on port 1420
- Launch the Tauri desktop app
- Enable hot module replacement for the frontend

### Production Build

Build the production version:

```bash
pnpm tauri build
```

The built application will be in `src-tauri/target/release/bundle/`

## Usage

### Workflow 1: Video Transcription & Translation

1. **Launch the Application**
   - In development: `pnpm tauri dev`
   - Or run the built executable
   - Select "Video Transcription" from landing page

2. **Add Videos**
   - Click "Add Videos" button
   - Select one or more video files
   - Supported formats: MP4, AVI, MKV, MOV, WMV, FLV, WebM, M4V, MPG, MPEG

3. **Choose Output Folder**
   - Click "Select Output Folder"
   - Choose where to save translated SRT files

4. **Select Target Language**
   - Choose English or Chinese from dropdown
   - Default: Chinese

5. **Start Processing**
   - Click "Start Extraction, Transcription & Translation"
   - The app will:
     - Extract audio from each video (16kHz, mono, WAV)
     - Upload to AssemblyAI for transcription
     - Generate original SRT (saved to temp)
     - Translate SRT via translation server
     - Save translated SRT with `_{lang}.srt` suffix
     - Clean up temp files on success

6. **Monitor Progress**
   - Watch real-time status: Pending → Extracting → Transcribing → Translating → Completed
   - View detailed logs by clicking task name
   - See separate counts for each stage

### Workflow 2: Direct SRT Translation

1. **Select "SRT Translation" from landing page**

2. **Add SRT Files**
   - Click "Add SRT Files" or drag-drop
   - Select one or more `.srt` files

3. **Choose Target Language**
   - Select English or Chinese

4. **Choose Output Folder**
   - Select where to save translated files

5. **Start Translation**
   - Click "Start Translation"
   - Translated files saved with `_{lang}.srt` suffix
   - Original files unchanged

## Architecture

### Tech Stack

- **Frontend:** React 19 with TanStack Router (file-based routing)
- **Desktop Wrapper:** Tauri v2 (Rust-based native app)
- **Build Tool:** Vite with Tailwind CSS v4
- **Audio Extraction:** FFmpeg (bundled as external binary)
- **Transcription:** AssemblyAI API (EU endpoint)
- **Translation:** Local HTTP server (configurable endpoint)
- **State Management:** React Context API with reducer pattern
- **UI Components:** Shadcn UI
- **Routing:** Landing page → Video/SRT workflows

### Pipeline Flows

#### Video Transcription & Translation Pipeline

```text
Video → FFmpeg → Temp WAV → AssemblyAI Upload → Transcription →
Poll Status → Temp SRT → Translation Server → Final Translated SRT → Cleanup
```

1. **Audio Extraction (FFmpeg)**
   - Extracts audio track from video
   - Converts to 16kHz mono WAV (optimized for speech)
   - Saves to temp directory: `{system_temp}/translation-app-audio/`

2. **Upload to AssemblyAI**
   - Uploads WAV to AssemblyAI's EU endpoint (GDPR compliant)
   - Receives upload URL

3. **Create Transcription**
   - Submits transcription request
   - Receives transcript ID

4. **Poll for Completion**
   - Polls every 3 seconds
   - Max 30 minutes timeout (600 attempts)
   - Automatic retry on network errors (3 attempts, exponential backoff)

5. **Download Original SRT**
   - Downloads completed transcript as SRT
   - Saves to temp directory with `-original.srt` suffix

6. **Translate SRT**
   - Sends SRT content to translation server
   - Target language: user-selected (en/zh)
   - Source language: auto-detected server-side
   - **Fallback:** Copies original SRT to output if translation fails
   - Retry logic: 3 attempts with exponential backoff (1s → 2s → 4s)

7. **Save Final SRT**
   - Saves translated SRT to output folder
   - Filename format: `{video_name}_{target_lang}.srt`

8. **Cleanup**
   - Removes temp WAV and temp original SRT on success
   - Keeps temp files for debugging on failure

#### Direct SRT Translation Pipeline

```text
SRT File → Translation Server → Translated SRT (with _{lang} suffix)
```

1. **Read SRT File**
   - User selects existing SRT files
   - No audio extraction or transcription needed

2. **Translate**
   - Sends SRT content to translation server
   - Same translation logic as video workflow
   - Fallback to original on failure

3. **Save Translated SRT**
   - Saves to output folder with `_{target_lang}.srt` suffix
   - Original file unchanged

### Key Files

**Frontend:**

- `src/routes/index.tsx` - Landing page with workflow selection
- `src/routes/video.tsx` - Video transcription workflow page
- `src/routes/srt.tsx` - Direct SRT translation workflow page
- `src/routes/task.$taskId.tsx` - Task detail view with logs
- `src/components/file-selector.tsx` - Video file picker
- `src/components/srt-file-selector.tsx` - SRT file picker with drag-drop
- `src/components/language-selector.tsx` - Target language dropdown
- `src/components/progress-summary.tsx` - Batch progress UI (dynamic for both workflows)
- `src/components/task-item.tsx` - Individual task status display
- `src/components/log-viewer.tsx` - Real-time log display
- `src/context/extraction-context.tsx` - State management (Context + Reducer)
- `src/hooks/use-extraction-commands.ts` - Video workflow Tauri commands
- `src/hooks/use-srt-translation-commands.ts` - SRT workflow Tauri commands
- `src/hooks/use-extraction-events.ts` - Event listeners for all workflows
- `src/types/extraction.ts` - TypeScript type definitions
- `src/env.ts` - Environment variable validation (T3 Env)

**Backend (Rust):**

- `src-tauri/src/lib.rs` - Main entry point, command handlers
  - `extract_audio_batch()` - Video workflow orchestration
  - `translate_srt_batch()` - Direct SRT translation orchestration
  - `get_task_logs()` - Fetch logs for detail view
  - `get_log_folder()` - Get logs directory path
- `src-tauri/src/ffmpeg.rs` - FFmpeg audio extraction
- `src-tauri/src/assemblyai.rs` - AssemblyAI transcription API
- `src-tauri/src/translation.rs` - Translation server integration
  - `translate_srt()` - Main translation function with fallback
  - Retry logic with exponential backoff
- `src-tauri/src/logger.rs` - Structured JSON logging system

## Development

### Commands

```bash
# Install dependencies
pnpm install

# Start dev server only (without Tauri)
pnpm dev

# Start Tauri app in dev mode
pnpm tauri dev

# Build for production
pnpm build
pnpm tauri build

# Preview production build
pnpm serve

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format

# Run both linter and formatter
pnpm check

# Add UI components
pnpx shadcn@latest add <component-name>
```

### Environment Variables

All environment variables must be prefixed with `VITE_` for client-side access.

Required variables:

- `VITE_ASSEMBLYAI_API_KEY` - Your AssemblyAI API key
- `VITE_TRANSLATION_SERVER_URL` - Translation server endpoint (default: `http://localhost:8000`)

Environment variables are validated using Zod schemas in `src/env.ts`.

### Path Aliases

- `@/*` maps to `./src/*` (configured in `tsconfig.json`)

## Configuration

### AssemblyAI Settings

The app uses the EU endpoint by default for GDPR compliance:

```rust
const ASSEMBLYAI_API_BASE: &str = "https://api.eu.assemblyai.com";
```

To change to the US endpoint, modify `src-tauri/src/assemblyai.rs`.

**Polling Configuration:**

- Poll interval: 3 seconds
- Max timeout: 30 minutes (600 attempts)

### Translation Server Settings

Default endpoint in `.env`:

```env
VITE_TRANSLATION_SERVER_URL=http://localhost:8000
```

**API Contract:**

- Endpoint: `POST /translate`
- Request body:

  ```json
  {
    "srt_content": "string",
    "target_language": "en" | "zh",
    "source_language": "auto" (optional),
    "country": null (optional),
    "model": null (optional)
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

To add more languages, update `src/components/language-selector.tsx`.

### FFmpeg Settings

Audio extraction settings in `src-tauri/src/ffmpeg.rs`:

- Sample rate: 16kHz (optimal for speech recognition)
- Channels: Mono (1 channel)
- Codec: PCM 16-bit (`pcm_s16le`)

### Retry Configuration

Network retry settings (both AssemblyAI and translation):

- Max retries: 3 attempts
- Initial delay: 1 second
- Backoff: Exponential (1s → 2s → 4s)

### Parallel Processing

Batch processing limits in `src-tauri/src/lib.rs`:

- Max concurrent tasks: 4 (controlled by semaphore)
- Applies to both video and SRT workflows

## Troubleshooting

### "Invalid API key" error

- Verify your `.env` file contains `VITE_ASSEMBLYAI_API_KEY=your_actual_key`
- Check that your API key is valid at [AssemblyAI Dashboard](https://www.assemblyai.com/app)
- Restart the app after changing `.env`

### Translation server connection failed

- Ensure translation server is running on configured port (default: 8000)
- Check `VITE_TRANSLATION_SERVER_URL` in `.env`
- Verify firewall settings allow localhost connections
- **Fallback behavior:** If translation fails, original SRT is saved to output folder

### FFmpeg not found (development)

- Install FFmpeg on your system: [ffmpeg.org](https://ffmpeg.org/download.html)
- Ensure `ffmpeg` is in your system PATH
- On Windows: Add FFmpeg to PATH and restart terminal

### Transcription timeout

- Videos longer than 30 minutes may timeout
- Check your internet connection
- Verify AssemblyAI service status

### Temp files not cleaned up

- Temp files are preserved on failure for debugging
- Location: `{system_temp}/translation-app-audio/`
- Includes: WAV audio files and `-original.srt` transcripts
- Safe to manually delete if space is needed

### Task logs location

- Logs stored in app data directory
- Get path via "Open Logs Folder" button in UI
- Each task has separate JSON log file
- Log types: `metadata`, `ffmpeg`, `ffprobe`, `assemblyai`, `translation`, `error`

## Contributing

1. Follow the existing code style
2. Run `pnpm check` before committing
3. Update documentation for new features
4. Add tests where applicable

## License

[Your License Here]

## Credits

- Built with [Tauri](https://tauri.app/)
- Transcription powered by [AssemblyAI](https://www.assemblyai.com/)
- Audio processing via [FFmpeg](https://ffmpeg.org/)
