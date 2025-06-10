const { app } = require('@azure/functions');
const df = require('durable-functions');

module.exports = app.http('ProcessMeetingStarter', {
  methods: ['post', 'get'],
  authLevel: 'anonymous',
  extraInputs: [df.input.durableClient()],   // 👈 required for getClient()
  handler: async (request, context) => {
    const client = df.getClient(context);
    const instanceId = await client.startNew('ProcessMeetingOrchestratorOrchestrator');
    context.log(`🚀 Started orchestration with ID = ${instanceId}`);
    return {
      status: 202,
      body: `Orchestration started. Check status at /runtime/webhooks/durabletask/instances/${instanceId}`
    };
  }
});