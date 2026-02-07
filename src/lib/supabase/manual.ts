import { supabase } from './client';
import { embedChunks } from '@/lib/openai/embeddings';

export interface ManualChunkInsert {
  product_id: string;
  chunk_title: string | null;
  chunk_text: string;
  source_ref: string;
  embedding: number[];
}

export async function insertManualChunks(chunks: ManualChunkInsert[]) {
  const { data, error } = await supabase
    .from('manual_chunks')
    .insert(
      chunks.map((c) => ({
        product_id: c.product_id,
        chunk_title: c.chunk_title,
        chunk_text: c.chunk_text,
        source_ref: c.source_ref,
        embedding: c.embedding,
      }))
    )
    .select('id');

  if (error) throw error;
  return { count: data?.length ?? 0 };
}

export async function searchManualChunks(params: {
  queryEmbedding: number[];
  productId?: string | null;
  matchThreshold?: number;
  matchCount?: number;
}) {
  const {
    queryEmbedding,
    productId = null,
    matchThreshold = 0.5,
    matchCount = 8,
  } = params;

  const { data, error } = await supabase.rpc('search_manual_chunks', {
    query_embedding: queryEmbedding,
    match_product_id: productId,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) throw error;
  return data ?? [];
}
