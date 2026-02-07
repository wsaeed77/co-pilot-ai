# Supabase Integration

## Overview

Supabase provides:

1. **PostgreSQL database** — Sessions, products, metadata
2. **pgvector** — Vector similarity search for manual RAG
3. **Storage** (optional) — Raw PDF manuals before ingestion

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-only, for admin operations
```

- `ANON_KEY`: Client-side (if needed for real-time subscriptions)
- `SERVICE_ROLE_KEY`: Server-side for manual ingestion, RLS bypass

---

## Database Schema

### Enable pgvector

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Table: `manual_chunks`

```sql
CREATE TABLE manual_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  chunk_title TEXT,
  chunk_text TEXT NOT NULL,
  source_ref TEXT,  -- e.g. "manual_name page 4"
  embedding vector(1536),  -- text-embedding-3-small dimension
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_manual_chunks_product ON manual_chunks(product_id);
CREATE INDEX idx_manual_chunks_embedding ON manual_chunks 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Table: `products`

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config JSONB NOT NULL,  -- full product JSON
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Table: `call_sessions`

```sql
CREATE TABLE call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id),
  lead_identifier TEXT,
  transcript JSONB DEFAULT '[]',  -- array of { speaker, text, timestamp }
  extracted_fields JSONB DEFAULT '{}',
  copilot_state JSONB,  -- last suggestions, etc.
  summary JSONB,       -- populated on session end
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_call_sessions_started ON call_sessions(started_at);
```

---

## Vector Similarity Search

### Function: search_manual_chunks

```sql
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
```

### Usage from Node

```typescript
const { data, error } = await supabase.rpc('search_manual_chunks', {
  query_embedding: embedding,
  match_product_id: productId || null,
  match_threshold: 0.5,
  match_count: 8,
});
```

---

## Client Setup

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // server-side only
);

// For client components (if needed):
export const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

---

## Implementation Locations

| File | Responsibility |
|------|----------------|
| `lib/supabase/client.ts` | Supabase client factories |
| `supabase/migrations/001_initial.sql` | Schema + vector function |
| `lib/supabase/manual.ts` | Insert chunks, search |
| `lib/supabase/sessions.ts` | Session CRUD |

---

## Manual Ingestion Flow

1. Parse PDF → text
2. Chunk text (300–800 tokens)
3. Call OpenAI embeddings for each chunk
4. Insert into `manual_chunks`:

```typescript
await supabase.from('manual_chunks').insert({
  product_id,
  chunk_title,
  chunk_text,
  source_ref,
  embedding,
});
```

---

## Storage (Optional)

For raw PDF storage before ingestion:

```typescript
const { data, error } = await supabase.storage
  .from('manuals')
  .upload(`${product_id}/${filename}`, file, { upsert: true });
```

---

## Row Level Security (RLS)

For MVP, RLS can be disabled or permissive. For production:

- `manual_chunks`: readable by authenticated users; writable by admin
- `call_sessions`: users see only their sessions
- `products`: readable by all; writable by admin

---

## Migrations

Run migrations via Supabase CLI:

```bash
supabase migration new initial
# Edit supabase/migrations/xxx_initial.sql
supabase db push
```

Or apply via Supabase Dashboard SQL editor for rapid prototyping.
