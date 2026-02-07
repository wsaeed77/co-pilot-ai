import { NextResponse } from 'next/server';
import { chunkText } from '@/lib/utils/chunk';
import { embedChunks } from '@/lib/openai/embeddings';
import { insertManualChunks } from '@/lib/supabase/manual';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const product_id = formData.get('product_id') as string;
    const manual_text = formData.get('manual_text') as string | null;
    const file = formData.get('file') as File | null;

    if (!product_id) {
      return NextResponse.json(
        { error: 'product_id required' },
        { status: 400 }
      );
    }

    let text = manual_text;
    if (!text && file) {
      const buffer = await file.arrayBuffer();
      const content = Buffer.from(buffer).toString('utf-8');
      // Simple text extraction; for PDFs use pdf-parse or similar
      text = content;
    }

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'manual_text or file with text content required' },
        { status: 400 }
      );
    }

    const chunks = chunkText(text);
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedChunks(chunkTexts);

    const toInsert = chunks.map((c, i) => ({
      product_id,
      chunk_title: c.title ?? null,
      chunk_text: c.text,
      source_ref: c.title ? `${product_id} ${c.title}` : `${product_id} chunk ${i + 1}`,
      embedding: embeddings[i] ?? [],
    }));

    // Delete existing chunks for this product (re-ingest)
    await supabase.from('manual_chunks').delete().eq('product_id', product_id);

    const { count } = await insertManualChunks(toInsert);
    return NextResponse.json({ count });
  } catch (error) {
    console.error('Manual upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload manual' },
      { status: 500 }
    );
  }
}
