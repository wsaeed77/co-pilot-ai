# OpenAI API Integration

## Overview

OpenAI powers the copilot's reasoning and manual retrieval. Two capabilities are used:

1. **Chat completions** — Copilot brain loop (suggestions, field extraction, grounded answers)
2. **Embeddings** — Text chunking for manual RAG (vector similarity search)

---

## Environment Variables

```env
OPENAI_API_KEY=sk-...
```

Store in `.env.local` (never commit). Add to Vercel environment for production.

---

## Models Used

| Use Case | Model | Notes |
|----------|------|------|
| Copilot reasoning | `gpt-4o-mini` or `gpt-4o` | Fast, cost-effective for structured JSON output |
| Embeddings | `text-embedding-3-small` | 1536 dimensions, good quality/cost ratio |

---

## 1. Embeddings (Manual RAG)

### Purpose

Convert manual text chunks into vectors for similarity search in Supabase pgvector.

### API Call

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

// Batch embedding (up to 2048 inputs per request)
async function embedChunks(chunks: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: chunks,
  });
  return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}
```

### Token Limits

- `text-embedding-3-small`: 8191 max tokens per input
- Batch: up to 2048 inputs per request
- Chunk size target: 300–800 tokens (~225–600 words)

### Cost (Approximate)

- $0.02 / 1M tokens (as of 2024)
- ~1536 dimensions per embedding

---

## 2. Chat Completions (Copilot Brain)

### Purpose

Process transcript + manual context → return structured JSON (suggestions, field updates, answers).

### API Call Pattern

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    {
      role: 'system',
      content: `You are a call copilot. Return ONLY valid JSON. Use manual excerpts to answer. If manual doesn't contain answer, say so.`,
    },
    {
      role: 'user',
      content: buildCopilotPrompt({
        transcript: recentTranscript,
        product: productJson,
        extractedFields: currentFields,
        manualChunks: retrievedChunks,
      }),
    },
  ],
  response_format: { type: 'json_object' },
  temperature: 0.3,
});
```

### Response Format

Use `response_format: { type: 'json_object' }` to enforce JSON-only output.

### JSON Schema (Expected Output)

```typescript
interface CopilotOutput {
  detected_product_id?: string;
  suggested_questions: Array<{ field: string; question: string }>;
  extracted_fields_updates: Record<string, string>;
  missing_required_fields: string[];
  answer_suggestions?: Array<{
    topic: string;
    answer: string;
    citations: string[];
  }>;
  agent_actions?: Array<{ type: string; message: string }>;
}
```

### Token Usage

- Input: transcript (60–120 sec) + product JSON + manual chunks (5–8) + instructions
- Output: ~200–500 tokens
- Use `gpt-4o-mini` for speed and cost; `gpt-4o` for higher accuracy if needed

---

## Implementation Locations

| File | Responsibility |
|------|----------------|
| `lib/openai/embeddings.ts` | `embedText()`, `embedChunks()` |
| `lib/openai/copilot.ts` | `runCopilotLoop()`, prompt builder |
| `lib/openai/types.ts` | `CopilotOutput`, prompt types |

---

## Error Handling

- **Rate limits:** Implement exponential backoff; consider request queuing for high volume
- **Invalid JSON:** Retry with stricter prompt; fallback to empty suggestions
- **Timeout:** Set `timeout` option; copilot should fail gracefully (show last known state)

---

## Security

- Never log `OPENAI_API_KEY`
- Do not send PII beyond what's necessary (transcript = PII; ensure data handling compliance)
- Consider transient storage for transcript buffers; purge after session end
