// src/functions/FetchTranscript.js
const df = require('durable-functions');
const axios = require('axios');

/**
 * Durable Activity
 * input = { resultUrl: "https://...json" }
 * Downloads the Speech JSON, flattens to plain text with speaker labels,
 * and returns that text.
 */
module.exports = df.app.activity('FetchTranscript', {
  handler: async (input, context) => {
    const { resultUrl } = input || {};
    if (!resultUrl) throw new Error('resultUrl is required');

    context.log(`📥 Downloading transcript JSON from ${resultUrl}`);

    // Speech result JSON is public via the signed URL, no auth header needed
    const { data } = await axios.get(resultUrl, { responseType: 'json' });

    // Convert JSON -> simple "S1: ...\nS2: ..." text
    const lines = [];
    for (const utterance of data?.combinedRecognizedPhrases ?? []) {
      const speaker = utterance.speaker || `S${utterance.channel}`;
      lines.push(`${speaker}: ${utterance.display}`);
    }
    const transcriptText = lines.join('\n');

    context.log(`✅ Parsed ${lines.length} utterances from transcript`);
    return transcriptText;
  }
});