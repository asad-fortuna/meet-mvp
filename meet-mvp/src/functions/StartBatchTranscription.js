// src/functions/StartBatchTranscription.js
const df = require('durable-functions');
const axios = require('axios');

/*
  Durable Activity
  input = { blobName: "audio-input/sample.mp4" }
  Expects the blob to live in the same Storage account defined by STORAGE_CONNECTION_STRING.
  The code generates a SAS URL valid for 24 h and feeds it to Speech Batch REST API.
*/
module.exports = df.app.activity('StartBatchTranscription', {
  handler: async (input, context) => {
    const { blobName } = input || {};
    if (!blobName) throw new Error('blobName is required');

    // ------------------------------------------------------------------
    // 1️⃣  Build a 24‑hour read‑only SAS URL for the audio blob
    // ------------------------------------------------------------------
    const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, SASProtocol } =
      require('@azure/storage-blob');

    const conn = process.env.STORAGE_CONNECTION_STRING;
    if (!conn) throw new Error('STORAGE_CONNECTION_STRING not set');

    const blobService = BlobServiceClient.fromConnectionString(conn);
    const containerName = process.env.AUDIO_INPUT_CONTAINER_NAME || 'audio-input';
    const container = blobService.getContainerClient(containerName);
    const blobClient = container.getBlobClient(blobName);

    // Expire in 24 hours
    const expiresOn = new Date(new Date().valueOf() + 24 * 60 * 60 * 1000);

    const sas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse('r'),
        expiresOn,
        protocol: SASProtocol.Https
      },
      blobService.credential
    ).toString();

    const sasUrl = `${blobClient.url}?${sas}`;
    context.log(`🔗 SAS URL generated: ${sasUrl}`);

    // ------------------------------------------------------------------
    // 2️⃣  Call Speech‑to‑Text Batch REST API v3.1
    // ------------------------------------------------------------------
    const speechKey = process.env.SPEECH_KEY;
    const speechEndpoint =
      process.env.SPEECH_ENDPOINT ||
      `https://${process.env.SPEECH_REGION}.api.cognitive.microsoft.com/`;

    if (!speechKey || !speechEndpoint) {
      throw new Error('SPEECH_KEY and SPEECH_ENDPOINT/REGION must be set');
    }

    const submitUrl = `${speechEndpoint}/speechtotext/v3.1/transcriptions`;

    const payload = {
      contentUrls: [sasUrl],
      locale: 'en-US',
      displayName: `Transcription_${Date.now()}`,
      properties: {
        diarizationEnabled: true,
        wordLevelTimestampsEnabled: true,
        punctuationMode: 'DictatedAndAutomatic',
        channels: [0]
      }
    };

    const { data } = await axios.post(submitUrl, payload, {
      headers: {
        'Ocp-Apim-Subscription-Key': speechKey,
        'Content-Type': 'application/json'
      }
    });

    // Location header gives the job URL; parse out the jobId
    const jobUrl = data.self || data.location || data.links.self;
    const jobId = jobUrl.split('/').pop();

    context.log(`🎙️  Speech transcription job submitted: ${jobId}`);

    return jobId;
  }
});
