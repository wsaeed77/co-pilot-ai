import { NextResponse } from 'next/server';
import { embedText } from '@/lib/openai/embeddings';

export async function GET() {
  const start = Date.now();
  try {
    await embedText('test');
    const duration = Date.now() - start;
    return NextResponse.json({
      status: 'ok',
      message: 'OpenAI API is working',
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error as { status?: number; code?: string; message?: string };
    const duration = Date.now() - start;
    return NextResponse.json(
      {
        status: 'error',
        message: err?.message ?? 'Unknown error',
        code: err?.code,
        statusCode: err?.status,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
