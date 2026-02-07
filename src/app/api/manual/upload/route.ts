import { NextResponse } from 'next/server';
import { chunkText } from '@/lib/utils/chunk';
import { embedChunks } from '@/lib/openai/embeddings';
import { insertManualChunks } from '@/lib/supabase/manual';
import { supabase } from '@/lib/supabase/client';
import { PDFParse } from 'pdf-parse';

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText({});
    return result.text ?? '';
  } finally {
    await parser.destroy();
  }
}

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
      const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        text = await extractTextFromPdf(buffer);
      } else {
        text = Buffer.from(buffer).toString('utf-8');
      }
    }

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'manual_text or PDF/text file with content required' },
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
