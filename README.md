# Translation App

A desktop application for extracting audio from video files and generating accurate transcripts using AssemblyAI's speech recognition API.

## Features

- **Video-to-Audio Extraction:** Extract high-quality WAV audio from video files using FFmpeg
- **Automatic Transcription:** Generate SRT subtitle files using AssemblyAI's speech recognition
- **Batch Processing:** Process up to 4 videos in parallel for maximum efficiency
- **Real-time Logging:** Monitor FFmpeg and AssemblyAI progress with detailed logs
- **Cross-platform:** Works on Windows, macOS, and Linux
- **Network Resilience:** Automatic retry with exponential backoff for network failures

## Prerequisites

1. **Rust:** Install the Rust toolchain from [rustup.rs](https://rustup.rs/)
2. **Node.js & pnpm:** Install [pnpm](https://pnpm.io/) package manager
3. **AssemblyAI API Key:** Get your free API key from [AssemblyAI](https://www.assemblyai.com/)

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
```

Get your API key from [https://www.assemblyai.com/](https://www.assemblyai.com/)

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

1. **Launch the Application**
   - In development: `pnpm tauri dev`
   - Or run the built executable

2. **Add Videos**
   - Click "Add Videos" button
   - Select one or more video files
   - Supported formats: MP4, AVI, MKV, MOV, WMV, FLV, WebM, M4V, MPG, MPEG

3. **Choose Output Folder**
   - Click "Select Output Folder"
   - Choose where to save the SRT subtitle files

4. **Start Processing**
   - Click "Start Extraction & Transcription"
   - The app will:
     - Extract audio from each video (16kHz, mono, WAV)
     - Upload to AssemblyAI
     - Generate SRT subtitle files
     - Save them in your output folder

5. **Monitor Progress**
   - Watch real-time status for each file
   - View detailed logs by clicking "View Details"
   - See separate counts for extracting and transcribing tasks

## Architecture

### Tech Stack

- **Frontend:** React 19 with TanStack Router (file-based routing)
- **Desktop Wrapper:** Tauri v2 (Rust-based native app)
- **Build Tool:** Vite with Tailwind CSS v4
- **Audio Extraction:** FFmpeg (bundled as external binary)
- **Transcription:** AssemblyAI API (EU endpoint)
- **State Management:** React Context API
- **UI Components:** Shadcn UI

### Pipeline Flow

```
Video File → FFmpeg → Temp WAV → AssemblyAI Upload →
Transcription → Poll Status → Download SRT → Cleanup Temp File
```

1. **Audio Extraction (FFmpeg)**
   - Extracts audio track from video
   - Converts to 16kHz mono WAV (optimized for speech)
   - Saves to temporary directory

2. **Upload to AssemblyAI**
   - Uploads WAV file to AssemblyAI's EU endpoint
   - Receives upload URL

3. **Create Transcription**
   - Submits transcription request
   - Receives transcript ID

4. **Poll for Completion**
   - Polls every 3 seconds
   - Max 30 minutes timeout (600 attempts)
   - Automatic retry on network errors

5. **Download SRT**
   - Downloads completed transcript as SRT file
   - Saves to user's chosen output folder

6. **Cleanup**
   - Removes temporary WAV file on success
   - Keeps temp file for debugging on failure

### Key Files

- `src/routes/` - Frontend pages (file-based routing)
- `src/components/` - React UI components
- `src/context/extraction-context.tsx` - State management
- `src/types/extraction.ts` - TypeScript type definitions
- `src-tauri/src/lib.rs` - Main Rust entry point
- `src-tauri/src/ffmpeg.rs` - FFmpeg audio extraction logic
- `src-tauri/src/assemblyai.rs` - AssemblyAI API integration
- `src-tauri/src/logger.rs` - Structured logging system

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

### FFmpeg Settings

Audio extraction settings in `src-tauri/src/ffmpeg.rs`:

- Sample rate: 16kHz (optimal for speech recognition)
- Channels: Mono (1 channel)
- Codec: PCM 16-bit (`pcm_s16le`)

### Retry Configuration

Network retry settings in `src-tauri/src/assemblyai.rs`:

- Max retries: 3 attempts
- Initial delay: 1 second
- Backoff: Exponential (1s → 2s → 4s)

## Troubleshooting

### "Invalid API key" error

- Verify your `.env` file contains `VITE_ASSEMBLYAI_API_KEY=your_actual_key`
- Check that your API key is valid at [AssemblyAI Dashboard](https://www.assemblyai.com/app)
- Restart the app after changing `.env`

### FFmpeg not found (development)

- Install FFmpeg on your system: [ffmpeg.org](https://ffmpeg.org/download.html)
- Ensure `ffmpeg` is in your system PATH
- On Windows: Add FFmpeg to PATH and restart terminal

### Transcription timeout

- Videos longer than 30 minutes may timeout
- Check your internet connection
- Verify AssemblyAI service status

### Temp files not cleaned up

- Temp files are preserved on transcription failure for debugging
- Location: `{system_temp}/translation-app-audio/`
- Safe to manually delete if space is needed

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
