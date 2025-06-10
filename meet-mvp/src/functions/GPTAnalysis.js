// ── src/functions/GPTAnalysis.js ──────────────────────────────────────────────
const df = require("durable-functions");
const { AzureOpenAI } = require("openai");          // ← from the ‘openai’ package
const axios         = require("axios");             // only used for safety ping

/**
 * Durable Activity
 * input = { transcript: "<speaker‑tagged text>" }
 * Calls your GPT‑4o deployment and returns structured JSON analysis.
 */
module.exports = df.app.activity("GPTAnalysis", {
  handler: async (input, context) => {
    const { transcript } = input ?? {};
    if (!transcript) throw new Error("transcript is required");

    /* ── 1.  Validate env ─────────────────────────────────────────────────── */
    const endpoint   = process.env.OPENAI_ENDPOINT?.replace(/\/+$/g, ""); // strip trailing /
    const apiKey     = process.env.OPENAI_KEY;
    const deployment = process.env.OPENAI_DEPLOYMENT;      // e.g. gpt-4o-notetaker
    const apiVersion = process.env.OPENAI_API_VERSION ?? "2024-02-01";
    if (!endpoint || !apiKey || !deployment)
      throw new Error(
        "OPENAI_ENDPOINT, OPENAI_KEY and OPENAI_DEPLOYMENT must be set"
      );

    /* ── 2.  Build Azure‑aware OpenAI client (v4 style) ──────────────────── */
    /*  The trick is to use AzureOpenAI from the *openai* pkg and point it   *
     *  at your resource.  Everything else (headers + api‑version) is wired  *
     *  in the options object.                                               */
    const client = new AzureOpenAI({
      apiKey,
      baseURL: `${endpoint}/openai/deployments/${deployment}`,
      defaultHeaders: { "api-key": apiKey },          // Azure expects this
      defaultQuery:   { "api-version": apiVersion },  // ditto
      timeout: 30_000                                // ms
    });

    /* Optional — quick health ping so we fail fast if the resource is down */
    try {
      await axios.get(`${endpoint}/openai/status?api-version=${apiVersion}`, {
        headers: { "api-key": apiKey },
        timeout: 6_000
      });
    } catch (_err) {
      context.log("⚠️  Azure OpenAI status check failed – continuing anyway");
    }

    /* ── 3.  Craft chat request ──────────────────────────────────────────── */
    const systemPrompt = `
You are an expert meeting assistant. Your task is to analyze the provided meeting transcript and extract key information.
Return **ONLY** valid JSON with these keys:

"meetingSummary"      : string  (2‑3 sentences)
"identifiedSpeakers"  : string[]            (e.g. ["Speaker 0","Speaker 1"])
"discussionPoints"    : string[]            (max 10)
"actionItems"         : {task,assignedTo,dueDate|null}[]
"nextSteps"           : string[]            (max 5)
"decisionsMade"       : string[]
"questionsRaised"     : {question,askedBy}[]

Follow the transcript faithfully; do not invent content.
`.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user",   content: transcript.slice(0, 16_000) } // keep token count safe
    ];

    /* ── 4.  Ask GPT‑4o (chat.completions.create) ───────────────────────── */
    const response = await client.chat.completions.create({
      model: deployment,          // “model” == deployment name for Azure
      messages,
      temperature: 0.2,
      max_tokens: 1024
    });

    /* ── parse JSON, stripping ``` fences if present ─────────────────────── */
    let text = (response.choices?.[0]?.message?.content ?? "").trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```[\w]*\s*/i, "").replace(/```$/i, "").trim();
    }

    let analysis;
    try {
      analysis = JSON.parse(text);
    } catch {
      context.log("⚠️  GPT response was not valid JSON:\n", text);
      throw new Error("GPT returned invalid JSON");
    }

    return analysis;
  }
});
