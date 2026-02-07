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

Return JSON with: suggested_questions (1-3), extracted_fields_updates (key/value from transcript), missing_required_fields (list), answer_suggestions (if lead asked product questions), agent_actions (warnings/reminders).`;

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

  return JSON.parse(content) as CopilotOutput;
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
