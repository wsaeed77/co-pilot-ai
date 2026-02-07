import { NextResponse } from 'next/server';
import { getSession, endSession } from '@/lib/supabase/sessions';
import { generateCallSummary } from '@/lib/openai/copilot';
import { getProduct } from '@/lib/products';
import type { ProductConfig } from '@/lib/openai/types';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { session_id } = body;

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

    const productId = session.product_id ?? 'ground_up_construction';
    const product = await getProduct(productId);

    const requiredKeys = product.required_fields.map((f) => f.key);
    const missingFields = requiredKeys.filter((k) => !extractedFields[k]);

    const { lead_summary, recommended_next_steps } = await generateCallSummary({
      transcript: transcript.map((u) => ({
        speaker: u.speaker === '0' ? 'lead' : 'agent',
        text: u.text,
        timestamp: u.timestamp,
      })),
      product,
      collectedFields: extractedFields,
      missingFields,
    });

    const summary = {
      product_id: productId,
      lead_summary,
      collected_fields: extractedFields,
      missing_fields: missingFields,
      recommended_next_steps,
    };

    await endSession(session_id, summary);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Session end error:', error);
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    );
  }
}
