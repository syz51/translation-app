# Transcription Backend - Quick Start

Simple Node.js backend that securely proxies transcription requests to AssemblyAI.

## Features

- ✅ Securely stores AssemblyAI API key on backend
- ✅ Simple REST API matching Tauri app expectations
- ✅ In-memory job storage (upgrade to database for production)
- ✅ SRT caching to reduce API calls
- ✅ Automatic file cleanup

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your AssemblyAI API key
```

### 3. Start Server

```bash
# Production
npm start

# Development (auto-restart on changes)
npm run dev
```

Server runs on `http://localhost:3000`

### 4. Test

```bash
# Health check
curl http://localhost:3000/api/health

# Upload audio file
curl -X POST http://localhost:3000/api/transcriptions \
  -F "audio_file=@test.wav" \
  -F "language_detection=true"

# Get status (replace JOB_ID)
curl http://localhost:3000/api/transcriptions/JOB_ID

# Download SRT (when completed)
curl http://localhost:3000/api/transcriptions/JOB_ID/srt
```

### 5. Update Tauri App

Update your Tauri app's `.env`:

```bash
VITE_TRANSCRIPTION_SERVER_URL=http://localhost:3000/api
```

## Production Deployment

### ⚠️ Before Production

This is a **minimal example**. For production:

1. **Add Authentication**
   - API keys, JWT tokens, or user accounts
   - See commented examples in code

2. **Use Database**
   - Replace in-memory `Map` with PostgreSQL/MongoDB
   - Store job metadata, track usage

3. **Add Rate Limiting**
   - Prevent abuse (e.g., `express-rate-limit`)

4. **Enable HTTPS**
   - Use reverse proxy (Nginx) with SSL
   - Or deploy to cloud platform with HTTPS

5. **Error Handling**
   - Better error messages
   - Retry logic for AssemblyAI failures
   - Logging with timestamps

6. **Monitoring**
   - Track API usage and costs
   - Set up alerts for failures

### Deploy Options

**Option 1: Docker**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t transcription-backend .
docker run -p 3000:3000 --env-file .env transcription-backend
```

**Option 2: Cloud Platforms**

- **Heroku**: `git push heroku main`
- **Railway**: Connect GitHub repo
- **Render**: Deploy from Git
- **DigitalOcean App Platform**: One-click deploy
- **AWS Elastic Beanstalk**: `eb init && eb deploy`

**Option 3: VPS (Ubuntu)**

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <your-repo>
cd backend-example
npm install
npm install -g pm2

# Start with PM2
pm2 start server.js --name transcription-backend
pm2 startup
pm2 save
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ASSEMBLYAI_API_KEY` | Yes | - | Your AssemblyAI API key |
| `PORT` | No | 3000 | Server port |
| `ASSEMBLYAI_BASE_URL` | No | `https://api.eu.assemblyai.com` | AssemblyAI endpoint (EU/US) |

## API Endpoints

See `../BACKEND_API_SPEC.md` for full documentation.

**Summary:**
- `GET /api/health` - Health check
- `POST /api/transcriptions` - Create transcription job
- `GET /api/transcriptions/:job_id` - Get status
- `GET /api/transcriptions/:job_id/srt` - Download SRT

## Security Notes

🔒 **Current Security:** NONE (local dev only)

For production, add:
- API authentication (API keys or JWT)
- Rate limiting (per IP/user)
- Input validation (file size/type)
- CORS restrictions (whitelist origins)
- Request logging
- Error message sanitization

## Cost Tracking

AssemblyAI charges **~$0.00025 per second** of audio.

Monitor costs:
```javascript
let totalSeconds = 0;
let totalCost = 0;

// After transcription completes
totalSeconds += audioDurationInSeconds;
totalCost = totalSeconds * 0.00025;
console.log(`Total cost: $${totalCost.toFixed(2)}`);
```

## Troubleshooting

**"ASSEMBLYAI_API_KEY environment variable is required"**
- Create `.env` file with your API key

**"Job not found"**
- Jobs are stored in memory and lost on restart
- Use database for persistence

**"Failed to create transcription job"**
- Check AssemblyAI API key is valid
- Check audio file format is supported
- Check AssemblyAI status: https://status.assemblyai.com

**Tauri app can't connect**
- Verify backend is running: `curl http://localhost:3000/api/health`
- Check `.env` has correct `VITE_TRANSCRIPTION_SERVER_URL`
- Check CORS settings if using different port

## Next Steps

1. ✅ Test locally with Tauri app
2. 🔧 Add authentication
3. 🔧 Replace in-memory storage with database
4. 🔧 Add rate limiting
5. 🚀 Deploy to cloud
6. 📊 Set up monitoring

## License

MIT

