// src/functions/CalendarPollerTimer.js
const { app } = require('@azure/functions');


// A one‑minute heartbeat so we can verify everything is wired up.
// * Cron format (seconds minutes hours day month day‑of‑week):
// * 0 */1 * * * *  ➜ at 0 sec every minute

module.exports = app.timer('CalendarPollerTimer', {
  schedule: '0 */1 * * * *',   // every minute
  handler: async (myTimer, context) => {
    const ts = new Date().toISOString();
    context.log(`✅ CalendarPollerTimer fired at ${ts}`);
  }
});
