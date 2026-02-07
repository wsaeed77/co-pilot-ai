import { NextResponse } from 'next/server';
import { appendTranscript } from '@/lib/supabase/sessions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { session_id, speaker, text, timestamp } = body;

    if (!session_id || !speaker || !text) {
      return NextResponse.json(
        { error: 'session_id, speaker, and text required' },
        { status: 400 }
      );
    }

    const ts = timestamp ?? new Date().toISOString();
    await appendTranscript(session_id, speaker, text, ts);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Ingest transcript error:', error);
    return NextResponse.json(
      { error: 'Failed to ingest transcript' },
      { status: 500 }
    );
  }
}
