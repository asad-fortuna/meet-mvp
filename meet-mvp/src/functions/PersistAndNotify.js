// src/functions/PersistAndNotify.js
const df = require('durable-functions');

/**
 * Durable Activity
 * input = { meetingId, analysis }
 */
module.exports = df.app.activity('PersistAndNotify', {
  handler: async (input, context) => {
    context.log('💾 PersistAndNotify received', input);

    // 🔜 Replace with Cosmos DB insert + SendGrid / Teams webhook.
    await new Promise(r => setTimeout(r, 500)); // pretend work

    context.log('✅ PersistAndNotify finished (stub)');
    return 'saved';
  }
});