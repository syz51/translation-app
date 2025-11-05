# Refactoring Summary: Secure Transcription Backend

## What Changed?

Your Tauri app now uses a **secure backend proxy** for transcription instead of calling AssemblyAI directly from the client. This prevents exposing your AssemblyAI API key to users.

## Files Modified

### Frontend (TypeScript)

1. **`src/env.ts`**
   - ❌ Removed: `VITE_ASSEMBLYAI_API_KEY`
   - ✅ Added: `VITE_TRANSCRIPTION_SERVER_URL` (default: `http://localhost:3000/api`)

2. **`src/hooks/use-extraction-commands.ts`**
   - Changed `startExtraction()` to pass `transcriptionServerUrl` instead of `apiKey`

3. **`.env`**
   - Removed AssemblyAI API key
   - Added transcription backend URL

### Backend (Rust)

1. **`src-tauri/src/backend_transcription.rs`** (NEW)
   - Complete replacement for direct AssemblyAI calls
   - Uses your backend as secure proxy
   - API endpoints:
     - `POST /transcriptions` - Upload audio
     - `GET /transcriptions/{job_id}` - Poll status
     - `GET /transcriptions/{job_id}/srt` - Download SRT

2. **`src-tauri/src/lib.rs`**
   - Changed imports: `mod backend_transcription` (replaced `mod assemblyai`)
   - Updated `extract_audio_batch()` signature:
     - ❌ Removed: `api_key: String`
     - ✅ Added: `transcription_server_url: String`
   - Calls `backend_transcription::transcribe_audio()` instead of `assemblyai::transcribe_audio()`

3. **`src-tauri/src/assemblyai.rs`** (DEPRECATED)
   - No longer used in production
   - Keep for reference or local development

### Documentation

1. **`BACKEND_API_SPEC.md`** (NEW)
   - Complete API specification for your backend
   - Implementation examples (Node.js, Python, Go)
   - Security best practices
   - Deployment guide

2. **`CLAUDE.md`** (UPDATED)
   - Updated architecture documentation
   - Reflects new secure backend flow
   - References `BACKEND_API_SPEC.md`

## Before vs After

### Before (Insecure)

```
Tauri App → AssemblyAI API
  ├─ API Key: Exposed in client code
  └─ Risk: Users can extract and abuse your key
```

### After (Secure)

```
Tauri App → YOUR Backend → AssemblyAI API
  ├─ API Key: Safely stored on backend only
  └─ Risk: Eliminated (with proper backend auth)
```

## What You Need to Do

### 1. Implement Backend Server

Use `BACKEND_API_SPEC.md` to build your backend. Choose your stack:

**Quick Start (Node.js + Express):**
```bash
mkdir transcription-backend
cd transcription-backend
npm init -y
npm install express multer axios uuid
```

**Quick Start (Python + FastAPI):**
```bash
mkdir transcription-backend
cd transcription-backend
pip install fastapi uvicorn python-multipart httpx
```

**Quick Start (Go + Gin):**
```bash
mkdir transcription-backend
cd transcription-backend
go mod init transcription-backend
go get github.com/gin-gonic/gin
```

See `BACKEND_API_SPEC.md` for complete implementation examples.

### 2. Deploy Backend

**Option 1: Cloud Providers**
- AWS (Lambda + API Gateway or ECS)
- Azure (App Service or Functions)
- Google Cloud (Cloud Run or App Engine)
- DigitalOcean (App Platform)

**Option 2: VPS**
- Deploy with Docker/Docker Compose
- Use Nginx as reverse proxy
- Set up SSL with Let's Encrypt

**Option 3: Serverless**
- Vercel (Node.js/Python)
- Netlify Functions
- AWS Lambda

### 3. Configure Environment

**Backend `.env` (KEEP SECRET!):**
```bash
ASSEMBLYAI_API_KEY=your_secret_key_here
DATABASE_URL=postgresql://...  # Optional
```

**Tauri App `.env` (Safe to distribute):**
```bash
VITE_TRANSCRIPTION_SERVER_URL=https://your-backend.com/api
VITE_TRANSLATION_SERVER_URL=https://text-translation-service...
```

### 4. Test End-to-End

```bash
# 1. Start your backend
cd transcription-backend
npm start  # or python main.py, or ./main

# 2. Update Tauri .env
echo "VITE_TRANSCRIPTION_SERVER_URL=http://localhost:3000/api" > .env

# 3. Start Tauri app
pnpm tauri dev

# 4. Test transcription workflow
# - Select a video file
# - Click "Start Extraction, Transcription & Translation"
# - Verify logs show backend URL (not AssemblyAI directly)
```

### 5. Add Authentication (Recommended)

Protect your backend from abuse:

**Option 1: API Keys**
```javascript
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ALLOWED_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

**Option 2: JWT Tokens**
```javascript
const jwt = require('jsonwebtoken');

app.use((req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});
```

**Option 3: User Accounts**
- Implement user registration/login
- Track usage per user
- Bill based on usage

## Security Checklist

- [ ] Backend deployed with HTTPS
- [ ] AssemblyAI API key stored only on backend (never in client code)
- [ ] Backend has rate limiting (e.g., 10 requests/minute per IP)
- [ ] Backend has authentication (API keys, JWT, or user accounts)
- [ ] Backend validates file uploads (type, size limits)
- [ ] Backend logs all requests for auditing
- [ ] Old transcription jobs are cleaned up (after 24-48 hours)
- [ ] Error messages don't leak sensitive info
- [ ] CORS configured properly
- [ ] Database credentials secured (if using DB)

## Cost Considerations

**AssemblyAI Pricing:** ~$0.00025 per second of audio (~$0.015 per minute)

**Example Costs:**
- 10-minute video: ~$0.15
- 100 videos/day: ~$15/day = ~$450/month
- 1000 videos/month: ~$150/month

**Tips to Reduce Costs:**
1. Cache transcriptions (don't re-transcribe same file)
2. Compress audio to 16kHz mono before upload
3. Set max file size/duration limits
4. Implement user quotas
5. Monitor usage with alerts

## Rollback Plan

If you need to revert to direct AssemblyAI calls (for local dev):

```bash
git checkout HEAD~1 src-tauri/src/lib.rs
git checkout HEAD~1 src/env.ts
git checkout HEAD~1 src/hooks/use-extraction-commands.ts
git checkout HEAD~1 .env
```

Or manually:
1. Change `mod backend_transcription` back to `mod assemblyai`
2. Add `VITE_ASSEMBLYAI_API_KEY` to `src/env.ts`
3. Pass `apiKey` instead of `transcriptionServerUrl` in hooks
4. Update `.env` with your API key

## Next Steps

1. **Immediate:** Implement backend using `BACKEND_API_SPEC.md`
2. **Day 1:** Deploy backend to cloud provider
3. **Day 2:** Test end-to-end with production URLs
4. **Day 3:** Add authentication and rate limiting
5. **Week 1:** Monitor costs and usage
6. **Week 2:** Optimize (caching, deduplication, compression)

## Questions?

- Backend API Spec: See `BACKEND_API_SPEC.md`
- AssemblyAI Docs: https://www.assemblyai.com/docs
- Tauri Docs: https://tauri.app
- Need help? Check logs in `{app_data}/logs/`

## Summary

✅ **Security:** API keys no longer exposed to clients  
✅ **Scalability:** Backend can implement caching, quotas, billing  
✅ **Flexibility:** Easy to switch transcription providers later  
✅ **Control:** Monitor and audit all transcription requests  

⚠️ **Required:** You must implement and deploy the backend for the app to work  
⚠️ **Cost:** Backend hosting + AssemblyAI usage (budget accordingly)  
⚠️ **Maintenance:** Backend needs monitoring, updates, scaling  

