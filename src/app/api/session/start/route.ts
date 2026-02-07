import { NextResponse } from 'next/server';
import { createSession } from '@/lib/supabase/sessions';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { product_id, lead_identifier } = body;

    const { session_id } = await createSession(product_id, lead_identifier);
    return NextResponse.json({ session_id });
  } catch (error) {
    console.error('Session start error:', error);
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500 }
    );
  }
}
