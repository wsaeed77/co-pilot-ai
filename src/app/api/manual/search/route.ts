import { NextResponse } from 'next/server';
import { embedText } from '@/lib/openai/embeddings';
import { searchManualChunks } from '@/lib/supabase/manual';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { product_id, query } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'query required' },
        { status: 400 }
      );
    }

    const embedding = await embedText(query);
    const chunks = await searchManualChunks({
      queryEmbedding: embedding,
      productId: product_id ?? null,
      matchCount: 8,
    });

    return NextResponse.json({ chunks });
  } catch (error) {
    console.error('Manual search error:', error);
    return NextResponse.json(
      { error: 'Failed to search manual' },
      { status: 500 }
    );
  }
}
