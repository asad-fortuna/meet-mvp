// src/functions/ProcessMeetingOrchestratorOrchestrator.js
const df = require('durable-functions');

module.exports = df.app.orchestration(
  'ProcessMeetingOrchestratorOrchestrator',
  function* (ctx) {
    // 1️⃣ Kick off Azure Speech batch transcription
    const jobId = yield ctx.df.callActivity('StartBatchTranscription', {
      blobName: 'sample.mp3'          // 🔜 replace with real blob path
    });

    // 2️⃣ Poll until the transcription job completes
    const resultUrl = yield ctx.df.callActivity('PollTranscription', {
      transcriptionJobId: jobId
    });

    // 3️⃣ Download the resulting transcript
    const transcript = yield ctx.df.callActivity('FetchTranscript', { resultUrl });

    // 4️⃣ Send transcript to GPT‑4o for structured insights
    const analysis = yield ctx.df.callActivity('GPTAnalysis', { transcript });

    // 5️⃣ Persist results and notify downstream channels (stub)
    const persistStatus = yield ctx.df.callActivity('PersistAndNotify', {
      meetingId: jobId,   // placeholder; later use real meeting ID
      analysis
    });

    // 6️⃣ Return everything for inspection
    return { transcriptionJobId: jobId, resultUrl, analysis, persistStatus };
  }
);
