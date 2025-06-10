Meeting Assistant MVP

Collects online‐meeting recordings, transcribes them with Azure Speech, distils insights with Azure OpenAI GPT‑4o, and returns structured JSON.

//** 1  Architecture **//

graph TD
  subgraph Azure Functions (Durable)
    A[CalendarPollerTimer] -->|blobName| B[StartBatchTranscription]
    B --> C[PollTranscription]
    C --> D[FetchTranscript]
    D --> E[GPTAnalysis]
    E --> F[PersistAndNotify]
  end
  Recorder[(Meeting Recording)] --> Storage[(Blob Storage audio-input)]
  Storage -->|SAS URL| B
  Storage -->|flatten JSON| D

Function                 |  Purpose

CalendarPollerTimer      |   Finds new recordings and kicks off a workflow every minute.

StartBatchTranscription  |  Creates a Speech Batch job, mono channel only.

PollTranscription        |  Polls Speech until Succeeded, returns JSON URL.

FetchTranscript          |  Downloads JSON, converts to Speaker: text lines.

GPTAnalysis              |  Calls GPT‑4o via Azure OpenAI v2 SDK, returns structured JSON.

PersistAndNotify         |  Stub – write to DB / send e‑mail / Teams card.

//** 2  Prerequisites **//

Azure resources Speech Service, Azure OpenAI, Storage Account

Node 18 + (NVM recommended)

Azure Functions Core Tools v4

ffmpeg (optional) – for audio conversion

jq – quick transcript flattening tests 

//** 3  Clone & Configure **//

git clone https://github.com/your‑org/meet‑mvp.git
cd meet‑mvp
npm install

Create local.settings.json (git‑ignored) and add secrets:

{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",

    "SPEECH_ENDPOINT": "https://<speech-resource>.cognitiveservices.azure.com/",
    "SPEECH_KEY": "<key>",
    "OPENAI_ENDPOINT": "https://<aoai-resource>.openai.azure.com/",
    "OPENAI_KEY": "<key>",
    "OPENAI_DEPLOYMENT": "gpt-4o-notetaker",
    "OPENAI_API_VERSION": "2024-02-01",

    "AUDIO_INPUT_CONTAINER_NAME": "audio-input",
    "TRANSCRIPTS_OUTPUT_CONTAINER_NAME": "transcripts-output"
  }
}

//** 4  Run Locally **//

func start    # hot‑reload host on http://localhost:7071

Trigger a manual run: curl http://localhost:7071/api/ProcessMeetingStarter
Check logs in the terminal. Use Durable Functions Runtime Explorer (⌘B in VS Code) to inspect orchestration instances.