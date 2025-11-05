require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const ASSEMBLYAI_BASE_URL = process.env.ASSEMBLYAI_BASE_URL || 'https://api.eu.assemblyai.com';

if (!ASSEMBLYAI_API_KEY) {
  console.error('ERROR: ASSEMBLYAI_API_KEY environment variable is required');
  process.exit(1);
}

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Enable CORS (configure for production)
app.use(cors());

// In-memory job store (use database in production)
const jobs = new Map();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Create transcription job
app.post('/api/transcriptions', upload.single('audio_file'), async (req, res) => {
  try {
    const audioFile = req.file;
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const languageDetection = req.body.language_detection !== 'false';
    const speakerLabels = req.body.speaker_labels !== 'false';

    console.log(`[NEW JOB] Uploading audio file: ${audioFile.originalname}`);

    // Step 1: Upload audio to AssemblyAI
    const audioData = await fs.readFile(audioFile.path);
    const uploadResponse = await axios.post(
      `${ASSEMBLYAI_BASE_URL}/v2/upload`,
      audioData,
      {
        headers: {
          'Authorization': ASSEMBLYAI_API_KEY,
          'Content-Type': 'application/octet-stream'
        }
      }
    );

    const uploadUrl = uploadResponse.data.upload_url;
    console.log(`[UPLOAD] Audio uploaded: ${uploadUrl}`);

    // Step 2: Create transcript request
    const transcriptResponse = await axios.post(
      `${ASSEMBLYAI_BASE_URL}/v2/transcript`,
      {
        audio_url: uploadUrl,
        language_detection: languageDetection,
        speaker_labels: speakerLabels,
        punctuate: true,
        format_text: true
      },
      {
        headers: {
          'Authorization': ASSEMBLYAI_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const transcriptId = transcriptResponse.data.id;
    const jobId = uuidv4();

    // Store job metadata
    jobs.set(jobId, {
      job_id: jobId,
      assemblyai_transcript_id: transcriptId,
      status: 'queued',
      created_at: new Date().toISOString(),
      audio_file_path: audioFile.path
    });

    console.log(`[JOB CREATED] Job ID: ${jobId} | Transcript ID: ${transcriptId}`);

    // Clean up uploaded file after delay (optional)
    setTimeout(async () => {
      try {
        await fs.unlink(audioFile.path);
        console.log(`[CLEANUP] Deleted audio file: ${audioFile.path}`);
      } catch (err) {
        console.error(`[CLEANUP ERROR] ${err.message}`);
      }
    }, 60000); // Delete after 1 minute

    res.status(201).json({
      job_id: jobId,
      status: 'queued',
      created_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR]', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to create transcription job',
      message: error.response?.data?.error || error.message
    });
  }
});

// Get transcription status
app.get('/api/transcriptions/:job_id', async (req, res) => {
  try {
    const { job_id } = req.params;
    const job = jobs.get(job_id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Poll AssemblyAI for current status
    const statusResponse = await axios.get(
      `${ASSEMBLYAI_BASE_URL}/v2/transcript/${job.assemblyai_transcript_id}`,
      {
        headers: {
          'Authorization': ASSEMBLYAI_API_KEY
        }
      }
    );

    const transcriptData = statusResponse.data;
    
    // Update job status
    job.status = transcriptData.status;
    if (transcriptData.status === 'completed') {
      job.completed_at = new Date().toISOString();
    } else if (transcriptData.status === 'error') {
      job.error = transcriptData.error;
    }

    jobs.set(job_id, job);

    console.log(`[STATUS] Job ${job_id}: ${job.status}`);

    res.json({
      job_id: job.job_id,
      status: job.status,
      progress: transcriptData.status === 'completed' ? 100 : undefined,
      error: job.error,
      completed_at: job.completed_at
    });

  } catch (error) {
    console.error('[ERROR]', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to get transcription status',
      message: error.response?.data?.error || error.message
    });
  }
});

// Download SRT file
app.get('/api/transcriptions/:job_id/srt', async (req, res) => {
  try {
    const { job_id } = req.params;
    const job = jobs.get(job_id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(404).json({
        error: 'Transcription not ready',
        status: job.status
      });
    }

    // Check if SRT is cached
    if (job.srt_content) {
      console.log(`[SRT CACHE HIT] Job ${job_id}`);
      return res.type('text/plain').send(job.srt_content);
    }

    // Download SRT from AssemblyAI
    const srtResponse = await axios.get(
      `${ASSEMBLYAI_BASE_URL}/v2/transcript/${job.assemblyai_transcript_id}/srt`,
      {
        headers: {
          'Authorization': ASSEMBLYAI_API_KEY
        }
      }
    );

    const srtContent = srtResponse.data;

    // Cache SRT content
    job.srt_content = srtContent;
    jobs.set(job_id, job);

    console.log(`[SRT DOWNLOAD] Job ${job_id}: ${srtContent.length} bytes`);

    res.type('text/plain').send(srtContent);

  } catch (error) {
    console.error('[ERROR]', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to download SRT',
      message: error.response?.data?.error || error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Transcription backend running on http://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
  console.log(`✅ API Base URL: http://localhost:${PORT}/api`);
  console.log(`\n⚠️  WARNING: In-memory storage - jobs will be lost on restart`);
  console.log(`⚠️  WARNING: No authentication - add auth before production use\n`);
});

