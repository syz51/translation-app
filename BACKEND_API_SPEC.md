# Transcription Backend API Specification

This document describes the backend API that securely handles AssemblyAI transcription requests without exposing API keys to the client.

## Overview

The backend acts as a secure proxy between your Tauri desktop app and AssemblyAI. The AssemblyAI API key is stored **only on the backend**, never exposed to client applications.

## Base URL

```
https://your-backend.com/api
```

## Authentication

**Optional but recommended:** Implement user authentication (JWT, API keys, etc.) to prevent abuse of your backend by unauthorized users.

## Endpoints

### 1. Create Transcription Job

Creates a new transcription job by uploading an audio file.

**Endpoint:** `POST /transcriptions`

**Request:**
- **Content-Type:** `multipart/form-data`
- **Body Parameters:**
  - `audio_file` (required): Audio file (WAV, MP3, etc.)
  - `language_detection` (optional): Boolean, default `true`
  - `speaker_labels` (optional): Boolean, default `true`

**Example Request:**
```bash
curl -X POST https://your-backend.com/api/transcriptions \
  -F "audio_file=@audio.wav" \
  -F "language_detection=true" \
  -F "speaker_labels=true"
```

**Response:** `201 Created`
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "created_at": "2025-11-06T10:30:00Z"
}
```

**Error Response:** `400 Bad Request`
```json
{
  "error": "Invalid audio file format"
}
```

---

### 2. Get Transcription Status

Polls the status of a transcription job.

**Endpoint:** `GET /transcriptions/{job_id}`

**Path Parameters:**
- `job_id` (required): UUID of the transcription job

**Example Request:**
```bash
curl https://your-backend.com/api/transcriptions/550e8400-e29b-41d4-a716-446655440000
```

**Response:** `200 OK`

**While Processing:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress": 45
}
```

**When Completed:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "completed_at": "2025-11-06T10:35:22Z"
}
```

**On Error:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "error",
  "error": "Audio file too large"
}
```

**Status Values:**
- `queued`: Job is waiting to be processed
- `processing`: Job is being transcribed
- `completed`: Transcription finished successfully
- `error`: Transcription failed

**Error Response:** `404 Not Found`
```json
{
  "error": "Job not found"
}
```

---

### 3. Download SRT Subtitle File

Downloads the completed SRT subtitle file.

**Endpoint:** `GET /transcriptions/{job_id}/srt`

**Path Parameters:**
- `job_id` (required): UUID of the transcription job

**Example Request:**
```bash
curl https://your-backend.com/api/transcriptions/550e8400-e29b-41d4-a716-446655440000/srt
```

**Response:** `200 OK`
- **Content-Type:** `text/plain; charset=utf-8`
- **Body:** SRT file content

**Example Response:**
```srt
1
00:00:00,000 --> 00:00:03,400
Hello, welcome to the video.

2
00:00:03,400 --> 00:00:06,177
This is a transcription test.
```

**Error Response:** `404 Not Found` (if job not completed yet)
```json
{
  "error": "Transcription not ready",
  "status": "processing"
}
```

---

### 4. Health Check (Optional)

Checks if the backend is operational.

**Endpoint:** `GET /health`

**Example Request:**
```bash
curl https://your-backend.com/api/health
```

**Response:** `200 OK`
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

---

## Backend Implementation Guide

### Required Functionality

Your backend must:

1. **Accept audio file uploads** via multipart form data
2. **Upload audio to AssemblyAI** using your API key (stored securely on backend)
3. **Create transcription request** with AssemblyAI
4. **Store job metadata** (job_id → AssemblyAI transcript_id mapping)
5. **Poll AssemblyAI** for status updates (or use webhooks)
6. **Cache completed SRT files** for download
7. **Clean up old jobs** after a reasonable time (e.g., 24 hours)

### AssemblyAI Integration

Your backend should interact with AssemblyAI's API:

**AssemblyAI Base URL:** `https://api.eu.assemblyai.com` (or `https://api.assemblyai.com` for US)

**Key Steps:**
1. Upload audio: `POST /v2/upload`
2. Create transcript: `POST /v2/transcript`
3. Poll status: `GET /v2/transcript/{transcript_id}`
4. Download SRT: `GET /v2/transcript/{transcript_id}/srt`

**Reference:** [AssemblyAI API Documentation](https://www.assemblyai.com/docs)

### Database Schema (Example)

```sql
CREATE TABLE transcription_jobs (
  job_id UUID PRIMARY KEY,
  assemblyai_transcript_id VARCHAR(255),
  status VARCHAR(50),
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  srt_content TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX idx_assemblyai_id ON transcription_jobs(assemblyai_transcript_id);
CREATE INDEX idx_status ON transcription_jobs(status);
CREATE INDEX idx_expires_at ON transcription_jobs(expires_at);
```

### Environment Variables

```bash
# AssemblyAI API Key (KEEP SECRET!)
ASSEMBLYAI_API_KEY=your_secret_key_here

# Optional: Database connection
DATABASE_URL=postgresql://user:pass@localhost/transcription_db

# Optional: Redis for job queue
REDIS_URL=redis://localhost:6379
```

### Example Backend Stack Options

**Option 1: Node.js + Express**
```javascript
const express = require('express');
const multer = require('multer');
const axios = require('axios');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/api/transcriptions', upload.single('audio_file'), async (req, res) => {
  // Upload to AssemblyAI
  const audioFile = req.file;
  const uploadUrl = await uploadToAssemblyAI(audioFile.path);
  const transcriptId = await createTranscript(uploadUrl);
  
  // Store job in database
  const jobId = uuidv4();
  await saveJob(jobId, transcriptId);
  
  res.status(201).json({
    job_id: jobId,
    status: 'queued',
    created_at: new Date().toISOString()
  });
});
```

**Option 2: Python + FastAPI**
```python
from fastapi import FastAPI, UploadFile
from uuid import uuid4

app = FastAPI()

@app.post("/api/transcriptions")
async def create_transcription(audio_file: UploadFile):
    # Upload to AssemblyAI
    upload_url = await upload_to_assemblyai(audio_file.file)
    transcript_id = await create_transcript(upload_url)
    
    # Store job in database
    job_id = str(uuid4())
    await save_job(job_id, transcript_id)
    
    return {
        "job_id": job_id,
        "status": "queued",
        "created_at": datetime.now().isoformat()
    }
```

**Option 3: Go + Gin**
```go
func CreateTranscription(c *gin.Context) {
    file, _ := c.FormFile("audio_file")
    
    // Upload to AssemblyAI
    uploadURL, _ := uploadToAssemblyAI(file)
    transcriptID, _ := createTranscript(uploadURL)
    
    // Store job in database
    jobID := uuid.New().String()
    saveJob(jobID, transcriptID)
    
    c.JSON(201, gin.H{
        "job_id": jobID,
        "status": "queued",
        "created_at": time.Now(),
    })
}
```

---

## Security Considerations

1. **Rate Limiting:** Implement per-user/IP rate limits to prevent abuse
2. **Authentication:** Require API keys or JWT tokens for production
3. **File Validation:** Validate audio file types and sizes
4. **CORS:** Configure proper CORS headers if needed
5. **API Key Storage:** Never expose AssemblyAI key to clients
6. **Audit Logging:** Log all requests for debugging/billing
7. **Job Expiration:** Clean up old jobs to save storage

---

## Client Integration (Tauri App)

Your Tauri app now calls your backend instead of AssemblyAI directly:

**Environment Variable:**
```bash
VITE_TRANSCRIPTION_SERVER_URL=https://your-backend.com/api
```

**Flow:**
1. Extract audio from video (FFmpeg)
2. Upload audio to **your backend** (`POST /transcriptions`)
3. Poll **your backend** for status (`GET /transcriptions/{job_id}`)
4. Download SRT from **your backend** (`GET /transcriptions/{job_id}/srt`)
5. Translate SRT (separate translation service)

---

## Testing

**Test with curl:**

```bash
# 1. Upload audio
JOB_ID=$(curl -X POST https://your-backend.com/api/transcriptions \
  -F "audio_file=@test.wav" | jq -r '.job_id')

# 2. Poll status
while true; do
  STATUS=$(curl https://your-backend.com/api/transcriptions/$JOB_ID | jq -r '.status')
  echo "Status: $STATUS"
  [ "$STATUS" = "completed" ] && break
  sleep 3
done

# 3. Download SRT
curl https://your-backend.com/api/transcriptions/$JOB_ID/srt > output.srt
```

---

## Monitoring & Metrics

**Key Metrics to Track:**
- Transcription job success/failure rate
- Average transcription time
- API costs (AssemblyAI charges per audio hour)
- Storage usage for cached SRTs
- Request rate per user/IP

**Recommended Tools:**
- Prometheus + Grafana for metrics
- Sentry for error tracking
- ELK stack for log aggregation

---

## Cost Optimization

**AssemblyAI Pricing:** ~$0.00025 per second of audio

**Tips to reduce costs:**
1. Cache completed transcriptions
2. Implement deduplication (same file = reuse result)
3. Set audio duration limits
4. Compress audio before upload (16kHz mono is sufficient)
5. Monitor usage per user

---

## Example Deployment

**Using Docker Compose:**

```yaml
version: '3.8'
services:
  backend:
    image: your-transcription-backend:latest
    ports:
      - "3000:3000"
    environment:
      - ASSEMBLYAI_API_KEY=${ASSEMBLYAI_API_KEY}
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=transcription_db
      - POSTGRES_PASSWORD=secret

  redis:
    image: redis:7-alpine
```

---

## Next Steps

1. **Implement the backend** using your preferred stack
2. **Deploy backend** to a cloud provider (AWS, Azure, Google Cloud, etc.)
3. **Update `.env`** with your backend URL
4. **Test end-to-end** with your Tauri app
5. **Add authentication** for production use
6. **Monitor costs** and optimize as needed

---

## Questions?

- AssemblyAI Docs: https://www.assemblyai.com/docs
- Tauri Docs: https://tauri.app
- Contact: [Your support email/channel]

