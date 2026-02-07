import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase/sessions';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id required' },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    return NextResponse.json({
      transcript: session.transcript,
      extracted_fields: session.extracted_fields,
      copilot_state: session.copilot_state,
      summary: session.summary,
      product_id: session.product_id,
      ended_at: session.ended_at,
    });
  } catch (error) {
    console.error('Session state error:', error);
    return NextResponse.json(
      { error: 'Failed to get session state' },
      { status: 500 }
    );
  }
}
