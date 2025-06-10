// src/functions/PollTranscription.js
const df = require('durable-functions');
const axios = require('axios');

/*
  Durable Activity
  input  = { transcriptionJobId: "guid-from-speech" }
  Polls every 15 s (max 20 tries) until the Speech job is Succeeded,
  then returns the JSON transcript file URL.
*/
module.exports = df.app.activity('PollTranscription', {
  handler: async (input, context) => {
    const { transcriptionJobId } = input || {};
    if (!transcriptionJobId)
      throw new Error('transcriptionJobId is required');

    const speechEndpoint =
      process.env.SPEECH_ENDPOINT ||
      `https://${process.env.SPEECH_REGION}.api.cognitive.microsoft.com/`;
    const speechKey = process.env.SPEECH_KEY;
    if (!speechKey || !speechEndpoint) {
      throw new Error('SPEECH_KEY and SPEECH_ENDPOINT/REGION must be set');
    }

    const jobUrl = `${speechEndpoint}/speechtotext/v3.1/transcriptions/${transcriptionJobId}`;

    const maxTries = 30;
    for (let i = 0; i < maxTries; i++) {
      const { data } = await axios.get(jobUrl, {
        headers: { 'Ocp-Apim-Subscription-Key': speechKey }
      });

      const status = data.status;
      context.log(`🔄 Poll #${i + 1}: status = ${status}`);

      // ── SUCCEEDED ─────────────────────────────────────────────
      if (status === 'Succeeded') {
        // 1. Get files list
        const filesUrl = data.links.files;
        const { data: files } = await axios.get(filesUrl, {
          headers: { 'Ocp-Apim-Subscription-Key': speechKey }
        });

        // 2. Log raw response once for debugging
        context.log('📂 Speech files response:');
        console.dir(files, { depth: null });

        // 3. Pick the .json transcription file
        const candidate = (files.values || []).find(f => {
          if (!(f && f.kind === 'Transcription' && f.links?.contentUrl)) return false;

          // Ignore query‑string when checking the extension
          const pathname = new URL(f.links.contentUrl).pathname.toLowerCase();
          return pathname.endsWith('.json');

        });

        if (!candidate) {
          throw new Error('No .json transcription file found in files listing.');
        }
        const jsonUrl = candidate.links.contentUrl;
        context.log(`✅ Transcription ready at ${jsonUrl}`);
        return jsonUrl;
      }

      // ── FAILED ────────────────────────────────────────────────
      if (status === 'Failed') {
        context.log('⚠️  Full job JSON on failure:');
        console.dir(data, { depth: null });

        const reason = data.statusMessage || '(no statusMessage returned)';
        throw new Error(
          `Speech batch job ${transcriptionJobId} failed – ${reason}`
        );
      }

      // ── Still running; wait and poll again ────────────────────
      await new Promise(r => setTimeout(r, 15000));
    }

    throw new Error(
      `Timed out after ${maxTries * 15}s waiting for job ${transcriptionJobId}`
    );
  }
});
