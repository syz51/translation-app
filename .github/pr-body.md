## 🔒 Security: Move Transcription to Backend Proxy

### Problem
**Security Vulnerability:** AssemblyAI API key was exposed in client-side code, allowing anyone to:
- Extract the key from the compiled desktop app
- Use it for their own projects (running up costs)
- Exhaust rate limits or get the key banned

When packaging Tauri apps, environment variables are **baked into JavaScript at build time**, making them visible to all users.

### Solution
Implement a **secure backend proxy** that:
- Stores AssemblyAI API key on backend only (never sent to client)
- Acts as intermediary between Tauri app and AssemblyAI
- Enables authentication, rate limiting, and cost tracking

### Architecture Change

**Before (Insecure):**
```
Tauri App → AssemblyAI API (direct)
  └─ API Key exposed in client code ❌
```

**After (Secure):**
```
Tauri App → YOUR Backend → AssemblyAI API
  └─ API Key safely stored on backend ✅
```

---

## 📝 Changes

### Frontend (TypeScript)
- **`src/env.ts`**: Removed `VITE_ASSEMBLYAI_API_KEY`, added `VITE_TRANSCRIPTION_SERVER_URL`
- **`src/hooks/use-extraction-commands.ts`**: Pass `transcriptionServerUrl` instead of `apiKey`
- **`.env`**: Updated with backend URL instead of API key

### Backend (Rust)
- **`src-tauri/src/backend_transcription.rs`** (NEW): Secure proxy module
  - `upload_audio()`: Upload to backend (multipart form)
  - `poll_transcription_status()`: Poll backend for job status
  - `download_srt()`: Download SRT from backend
  - Retry logic with exponential backoff (3 attempts, 1s → 2s → 4s)
  
- **`src-tauri/src/lib.rs`**: Updated to use `backend_transcription` module
  - Changed `extract_audio_batch()` signature (removed `api_key`, added `transcription_server_url`)
  - Calls new backend proxy instead of direct AssemblyAI

- **`src-tauri/src/assemblyai.rs`**: Deprecated (keep for reference)

### Backend Implementation Example
- **`backend-example/`**: Complete Node.js backend implementation
  - `server.js`: Express server with all endpoints
  - `package.json`: Dependencies
  - `.env.example`: Configuration template
  - `README.md`: Setup and deployment guide

### Documentation
- **`CLAUDE.md`**: Updated architecture documentation
- **`backend-example/README.md`**: Backend quick start guide

---

## 🔌 Backend API Specification

Your backend must implement these endpoints:

### 1. Create Transcription Job
```http
POST /api/transcriptions
Content-Type: multipart/form-data

Body:
  - audio_file: File (required)
  - language_detection: boolean (optional, default: true)
  - speaker_labels: boolean (optional, default: true)

Response (201 Created):
{
  "job_id": "uuid",
  "status": "queued",
  "created_at": "2025-11-06T10:30:00Z"
}
```

### 2. Get Transcription Status
```http
GET /api/transcriptions/{job_id}

Response (200 OK):
{
  "job_id": "uuid",
  "status": "queued" | "processing" | "completed" | "error",
  "progress": 0-100,
  "error": "message",
  "completed_at": "timestamp"
}
```

### 3. Download SRT
```http
GET /api/transcriptions/{job_id}/srt

Response (200 OK):
Content-Type: text/plain
Body: SRT file content
```

---

## 🚀 Quick Start

### 1. Setup Backend

```bash
cd backend-example
npm install
cp .env.example .env
# Edit .env and add your AssemblyAI API key
npm start
```

Backend runs on `http://localhost:3000`

### 2. Update Tauri App

```bash
# Update .env
echo "VITE_TRANSCRIPTION_SERVER_URL=http://localhost:3000/api" > .env

# Test
pnpm tauri dev
```

### 3. Deploy Backend (Production)

**Quick Deploy Options:**
- Heroku: `git push heroku main`
- Railway: Connect GitHub repo
- Render: One-click deploy
- DigitalOcean: App Platform
- AWS: Elastic Beanstalk or ECS

**Environment Variables (Backend):**
```bash
ASSEMBLYAI_API_KEY=your_secret_key_here  # KEEP SECRET!
PORT=3000
ASSEMBLYAI_BASE_URL=https://api.eu.assemblyai.com
```

---

## ⚠️ Before Merging

### Required Actions

1. ✅ **Implement Backend**
   - Use `backend-example/` as starting point
   - Or implement in Python/Go (same API spec)

2. ✅ **Deploy Backend**
   - Choose cloud provider
   - Configure HTTPS
   - Set environment variables

3. ✅ **Update Tauri App Config**
   - Set `VITE_TRANSCRIPTION_SERVER_URL` to production URL
   - Test end-to-end

### Recommended (Before Production)

4. 🔐 **Add Authentication**
   - API keys, JWT tokens, or user accounts
   - Prevent unauthorized access

5. 🚦 **Add Rate Limiting**
   - Prevent abuse (e.g., 10 req/min per IP)
   - Use `express-rate-limit` or similar

6. 💾 **Use Database**
   - Replace in-memory storage with PostgreSQL/MongoDB
   - Track job history and usage

7. 📊 **Monitor Costs**
   - AssemblyAI charges ~$0.00025/sec of audio
   - Set up usage alerts

---

## 🧪 Testing

### Test Backend Locally

```bash
# Health check
curl http://localhost:3000/api/health

# Upload audio
curl -X POST http://localhost:3000/api/transcriptions \
  -F "audio_file=@test.wav" \
  -F "language_detection=true"

# Get status (replace JOB_ID)
curl http://localhost:3000/api/transcriptions/JOB_ID

# Download SRT (when completed)
curl http://localhost:3000/api/transcriptions/JOB_ID/srt
```

### Test Tauri App

1. Select video file
2. Click "Start Extraction, Transcription & Translation"
3. Check logs show backend URL (not AssemblyAI)
4. Verify translated SRT output

---

## 📊 Cost Impact

**AssemblyAI Pricing:**
- ~$0.00025 per second of audio
- ~$0.015 per minute
- ~$0.90 per hour

**Example Monthly Costs:**
- 100 videos @ 10 min each = ~$150/month
- 1000 videos @ 10 min each = ~$1,500/month

**Backend Hosting:**
- Heroku/Railway/Render: $7-25/month (hobby tier)
- AWS/Azure/GCP: Variable (pay per use)
- VPS: $5-20/month (DigitalOcean, Linode)

---

## 🔐 Security Checklist

- [ ] Backend deployed with HTTPS
- [ ] API key stored only on backend (never in client)
- [ ] Rate limiting enabled
- [ ] Authentication implemented
- [ ] File upload validation (type, size)
- [ ] Request logging for auditing
- [ ] Old jobs cleaned up (24-48h)
- [ ] Error messages don't leak secrets
- [ ] CORS configured properly

---

## 📚 Additional Resources

- **Backend Example Code:** `backend-example/` (Node.js/Express)
- **Implementation Guide:** `backend-example/README.md`
- **AssemblyAI Docs:** https://www.assemblyai.com/docs
- **Tauri Security:** https://tauri.app/v2/security/

---

## 🤔 Discussion Points

- Backend stack preference? (Node.js provided, but Python/Go also viable)
- Cloud provider for deployment?
- Auth strategy: API keys, JWT, or user accounts?
- Database choice for job storage?
- Cost budget and monitoring approach?

