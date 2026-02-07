-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Products table
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Manual chunks for RAG
CREATE TABLE manual_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  chunk_title TEXT,
  chunk_text TEXT NOT NULL,
  source_ref TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_manual_chunks_product ON manual_chunks(product_id);
CREATE INDEX idx_manual_chunks_embedding ON manual_chunks 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Call sessions
CREATE TABLE call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id),
  lead_identifier TEXT,
  transcript JSONB DEFAULT '[]',
  extracted_fields JSONB DEFAULT '{}',
  copilot_state JSONB,
  summary JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_call_sessions_started ON call_sessions(started_at);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION search_manual_chunks(
  query_embedding vector(1536),
  match_product_id TEXT DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  product_id TEXT,
  chunk_title TEXT,
  chunk_text TEXT,
  source_ref TEXT,
  similarity FLOAT
) AS $$
  SELECT
    mc.id,
    mc.product_id,
    mc.chunk_title,
    mc.chunk_text,
    mc.source_ref,
    1 - (mc.embedding <=> query_embedding) AS similarity
  FROM manual_chunks mc
  WHERE
    (match_product_id IS NULL OR mc.product_id = match_product_id)
    AND (1 - (mc.embedding <=> query_embedding)) > match_threshold
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql STABLE;
