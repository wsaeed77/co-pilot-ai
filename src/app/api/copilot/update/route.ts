import { NextResponse } from 'next/server';
import { getSession, updateSessionState } from '@/lib/supabase/sessions';
import { searchManualChunks } from '@/lib/supabase/manual';
import { embedText } from '@/lib/openai/embeddings';
import { runCopilotLoop } from '@/lib/openai/copilot';
import { getProduct } from '@/lib/products';
import type { TranscriptUtterance } from '@/lib/openai/types';

export async function POST(request: Request) {
  let session_id: string | undefined;
  try {
    const body = await request.json();
    session_id = body.session_id;

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id required' },
        { status: 400 }
      );
    }

    const session = await getSession(session_id);
    const transcript = (session.transcript ?? []) as Array<{
      speaker: string;
      text: string;
      timestamp: string;
    }>;
    const extractedFields = (session.extracted_fields ?? {}) as Record<string, string>;

    if (transcript.length === 0) {
      return NextResponse.json({
        suggested_questions: [],
        extracted_fields_updates: {},
        missing_required_fields: [],
        answer_suggestions: [],
        agent_actions: [],
      });
    }

    const productId = session.product_id ?? 'ground_up_construction';
    const product = await getProduct(productId);

    // Recent transcript (last ~60-90 seconds of content)
    const recentTranscript = transcript.slice(-20).map((u) => ({
      speaker: (u.speaker === '0' ? 'lead' : 'agent') as 'lead' | 'agent',
      text: u.text,
      timestamp: u.timestamp,
    })) as TranscriptUtterance[];

    // Build query from recent lead utterances for RAG
    const leadText = transcript
      .filter((u) => u.speaker === '0')
      .slice(-5)
      .map((u) => u.text)
      .join(' ');

    const queryEmbedding = leadText
      ? await embedText(leadText)
      : await embedText(transcript.slice(-3).map((u) => u.text).join(' '));

    const manualChunks = await searchManualChunks({
      queryEmbedding,
      productId,
      matchCount: 8,
    });

    const output = await runCopilotLoop({
      transcript: recentTranscript,
      product,
      extractedFields,
      manualChunks: manualChunks.map((c: { chunk_text: string; source_ref: string | null }) => ({
        chunk_text: c.chunk_text,
        source_ref: c.source_ref,
      })),
    });

    const mergedFields = { ...extractedFields, ...output.extracted_fields_updates };
    await updateSessionState(session_id, {
      extracted_fields: mergedFields,
      copilot_state: output as unknown as Record<string, unknown>,
    });

    return NextResponse.json(output);
  } catch (error: unknown) {
    console.error('Copilot update error:', error);
    const err = error as { status?: number; code?: string; message?: string };
    if ((err?.status === 429 || err?.code === 'insufficient_quota') && session_id) {
      try {
        // Fallback: show questions from product config for missing fields
        const sess = await getSession(session_id);
        const productId = sess.product_id ?? 'ground_up_construction';
        const product = await getProduct(productId);
        const extractedFields = (sess.extracted_fields ?? {}) as Record<string, string>;
        const missing = product.required_fields
          .filter((f) => !extractedFields[f.key])
          .map((f) => f.key);
        const fallbackQuestions = product.required_fields
          .filter((f) => missing.includes(f.key))
          .slice(0, 3)
          .map((f) => ({ field: f.key, question: f.question }));

        return NextResponse.json(
          {
            error: 'OpenAI quota exceeded. Add billing at platform.openai.com.',
            suggested_questions: fallbackQuestions,
            extracted_fields_updates: {},
            missing_required_fields: missing,
            answer_suggestions: [],
            agent_actions: [],
          },
          { status: 402 }
        );
      } catch {
        // Fallback failed, return empty
        return NextResponse.json(
          {
            error: 'OpenAI quota exceeded. Add billing at platform.openai.com.',
            suggested_questions: [],
            extracted_fields_updates: {},
            missing_required_fields: [],
            answer_suggestions: [],
            agent_actions: [],
          },
          { status: 402 }
        );
      }
    }
    return NextResponse.json(
      { error: 'Failed to update copilot' },
      { status: 500 }
    );
  }
}
