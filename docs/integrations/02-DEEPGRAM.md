# Deepgram Integration

## Overview

Deepgram provides **real-time streaming speech-to-text** with speaker diarization. The copilot streams microphone audio from the client, relays it to Deepgram, and receives live transcript events with speaker labels.

---

## Environment Variables

```env
DEEPGRAM_API_KEY=...
```

Get from [Deepgram Console](https://console.deepgram.com/). Store in `.env.local`.

---

## Architecture

```
[Browser Mic] → [Next.js API] → [Deepgram Live API] → [Transcript Events]
                     ↑                                    ↓
                     └────── Session State / WebSocket ────┘
```

### Flow

1. **Client** captures microphone via `MediaRecorder` or WebSocket
2. **Server** establishes live connection to Deepgram
3. **Audio** streams from client → server → Deepgram
4. **Deepgram** returns `Transcript` objects (speaker, text, timestamps)
5. **Server** appends to session transcript buffer and pushes to UI via SSE/WebSocket

---

## Live Streaming API

### Endpoint

```
wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&diarize=true
```

### Key Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `model` | `nova-2` | Best balance of speed/accuracy |
| `language` | `en` | English |
| `smart_format` | `true` | Punctuation, numbers, etc. |
| `diarize` | `true` | Speaker separation (Speaker 0, 1, …) |
| `utterances` | `true` | (Optional) Chunk by speaker turn |
| `interim_results` | `true` | (Optional) Low-latency partial results |

### Connection

```typescript
import WebSocket from 'ws';

const ws = new WebSocket(
  `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&diarize=true`,
  {
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
    },
  }
);

ws.on('message', (data) => {
  const event = JSON.parse(data.toString());
  if (event.type === 'Results') {
    const transcript = event.channel?.alternatives?.[0]?.transcript;
    const speaker = event.channel?.alternatives?.[0]?.words?.[0]?.speaker;
    // Append to session state
  }
});
```

---

## Transcript Event Shape

```typescript
interface DeepgramTranscriptEvent {
  type: 'Results';
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence?: number;
      words?: Array<{
        word: string;
        start: number;
        end: number;
        speaker: number;  // 0, 1, 2, ...
      }>;
    }>;
  };
  is_final?: boolean;
}
```

### Speaker Mapping (MVP)

- **Speaker 0** = Lead (default)
- **Speaker 1** = Agent
- Toggle in UI if diarization is wrong

---

## Client-Side Audio Capture

### Option A: WebSocket (preferred for streaming)

```typescript
// Client streams audio chunks to /api/transcription/stream
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
mediaRecorder.ondataavailable = (e) => {
  if (e.data.size > 0) fetch('/api/transcription/stream', { body: e.data, ... });
};
mediaRecorder.start(250); // 250ms chunks
```

### Option B: Deepgram pre-recorded SDK

For testing without live mic, use pre-recorded file:

```bash
curl -X POST "https://api.deepgram.com/v1/listen?diarize=true" \
  -H "Authorization: Token $DEEPGRAM_API_KEY" \
  -H "Content-Type: audio/wav" \
  --data-binary @recording.wav
```

---

## API Endpoints (Our App)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/transcription/stream` | Receive audio chunks, forward to Deepgram |
| WebSocket | `/api/transcription/ws` | Bidirectional: client sends audio, server sends transcript events |

### Recommended: WebSocket proxy

- Client opens WebSocket to `/api/transcription/ws?session_id=xxx`
- Server opens parallel WebSocket to Deepgram
- Server forwards: client audio → Deepgram; Deepgram results → client + session state

---

## Implementation Locations

| File | Responsibility |
|------|----------------|
| `lib/deepgram/client.ts` | Create live connection, parse events |
| `app/api/transcription/ws/route.ts` | WebSocket handler (or separate server) |
| `lib/session/transcript.ts` | Append transcript to session, emit to UI |

---

## Latency

- Target: transcript updates every 1–3 seconds
- `interim_results=true` for faster partial text
- Use `is_final` to avoid duplicate final transcripts

---

## Billing / Limits

- Pay per audio minute
- Check [Deepgram pricing](https://deepgram.com/pricing)
- Implement connection timeout and cleanup on session end

---

## Error Handling

- **Connection drop:** Reconnect with backoff; notify agent
- **No audio:** Detect silence; optional “no speech detected” indicator
- **Invalid API key:** Return 401; log server-side only
