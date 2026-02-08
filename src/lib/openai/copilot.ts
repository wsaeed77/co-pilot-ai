import OpenAI from 'openai';
import type { CopilotOutput, ProductConfig, TranscriptUtterance } from './types';

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
  });
}

const COPILOT_MODEL = 'gpt-4o-mini';

interface ManualChunk {
  chunk_text: string;
  source_ref: string | null;
}

export async function runCopilotLoop(params: {
  transcript: TranscriptUtterance[];
  product: ProductConfig;
  extractedFields: Record<string, string>;
  manualChunks: ManualChunk[];
}): Promise<CopilotOutput> {
  const { transcript, product, extractedFields, manualChunks } = params;

  const transcriptText = transcript
    .map((u) => `[${u.speaker.toUpperCase()}]: ${u.text}`)
    .join('\n');

  const manualContext = manualChunks
    .map((c) => `[${c.source_ref || 'manual'}]: ${c.chunk_text}`)
    .join('\n\n');

  const systemPrompt = `You are a call copilot for a sales/loan agent. You help qualify leads and answer product questions.
Return ONLY valid JSON. No markdown, no commentary.
- Use manual excerpts to answer product questions. If the manual doesn't contain the answer, set answer_suggestions with: "I don't see that in the manual excerpts. Ask clarifying questions or check the policy."
- Do not provide binding commitments, approval, or final pricing.
- Provide ranges/conditions only if the manual explicitly states them.`;

  const userPrompt = `## Recent transcript
${transcriptText}

## Product
${JSON.stringify(product, null, 2)}

## Extracted fields so far
${JSON.stringify(extractedFields)}

## Manual excerpts (use only these for answers)
${manualContext || '(no manual chunks retrieved)'}

Return JSON with this exact structure:
{
  "suggested_questions": [{ "field": "field_key", "question": "Question to ask?" }],
  "extracted_fields_updates": {},
  "missing_required_fields": [],
  "answer_suggestions": [],
  "agent_actions": []
}

ALWAYS include 1-3 suggested_questions. Base them on missing_required_fields: for each missing field, use the product's required_fields to get the question. Prioritize the most relevant next question for the conversation.`;

  const response = await getOpenAI().chat.completions.create({
    model: COPILOT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      suggested_questions: [],
      extracted_fields_updates: {},
      missing_required_fields: product.required_fields.map((f) => f.key),
      answer_suggestions: [],
      agent_actions: [],
    };
  }

  const parsed = JSON.parse(content) as CopilotOutput;
  const mergedFields = { ...extractedFields, ...(parsed.extracted_fields_updates ?? {}) };
  const missing =
    parsed.missing_required_fields ??
    product.required_fields.filter((f) => !mergedFields[f.key]).map((f) => f.key);
  let questions = Array.isArray(parsed.suggested_questions) ? parsed.suggested_questions : [];

  // Fallback: if LLM returned empty suggested_questions, use product config for missing fields
  if (questions.length === 0 && missing.length > 0) {
    questions = product.required_fields
      .filter((f) => missing.includes(f.key))
      .slice(0, 3)
      .map((f) => ({ field: f.key, question: f.question }));
  }

  // Normalize: ensure each item has .question (handle string or {question} format)
  questions = questions.map((q) =>
    typeof q === 'string' ? { field: '', question: q } : { field: q?.field ?? '', question: q?.question ?? '' }
  ).filter((q) => q.question);

  return { ...parsed, suggested_questions: questions };
}

export async function generateCallSummary(params: {
  transcript: TranscriptUtterance[];
  product: ProductConfig;
  collectedFields: Record<string, string>;
  missingFields: string[];
}): Promise<{
  lead_summary: string;
  recommended_next_steps: string[];
}> {
  const { transcript, product, collectedFields, missingFields } = params;

  const transcriptText = transcript
    .map((u) => `[${u.speaker}]: ${u.text}`)
    .join('\n');

  const response = await getOpenAI().chat.completions.create({
    model: COPILOT_MODEL,
    messages: [
      {
        role: 'system',
        content: 'Return only valid JSON with keys: lead_summary (short), recommended_next_steps (array of strings).',
      },
      {
        role: 'user',
        content: `Transcript:\n${transcriptText}\n\nCollected: ${JSON.stringify(collectedFields)}\nMissing: ${missingFields.join(', ')}\n\nGenerate lead_summary and recommended_next_steps.`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      lead_summary: 'No summary generated.',
      recommended_next_steps: missingFields.map((f) => `Follow up to obtain ${f}.`),
    };
  }

  return JSON.parse(content);
}
