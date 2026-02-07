/**
 * Upload PDFs from ppl-docs to Supabase manual chunks.
 * Run: npx tsx scripts/upload-ppl-docs.ts
 * Requires: .env.local or .env.production with OPENAI_API_KEY, Supabase vars
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { PDFParse } from 'pdf-parse';
import { config } from 'dotenv';

// Load env
config({ path: '.env.production' });
config({ path: '.env.local' });

const PPL_DOCS = join(process.cwd(), 'ppl-docs');

// Map PDF filename to product_id
const PDF_TO_PRODUCT: Record<string, string> = {
  'Ground Up Product Manual (1).pdf': 'ground_up_construction',
  'Fix & Flip Product Manual (1).pdf': 'fix_and_flip',
  'Fix & Flip Tearsheet (1).pdf': 'fix_and_flip',
  'Rental Loans Product Manual.pdf': 'rental_loans',
  'Stabilized Bridge Product Manual.pdf': 'stabilized_bridge',
  'MF SBL FAQ (external).pdf': 'mf_sbl_faq',
};

async function extractTextFromPdf(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText({});
    return result.text ?? '';
  } finally {
    await parser.destroy();
  }
}

function chunkText(text: string): Array<{ text: string; title?: string }> {
  const minChars = 400;
  const maxChars = 2400;
  const chunks: Array<{ text: string; title?: string }> = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';
  let title: string | undefined;

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    if (trimmed.length < 100 && /^[A-Z][a-z\s]+:?$/.test(trimmed)) {
      if (current) {
        chunks.push({ text: current.trim(), title });
        current = '';
      }
      title = trimmed.replace(/:$/, '');
      continue;
    }

    if (current.length + trimmed.length > maxChars && current) {
      chunks.push({ text: current.trim(), title });
      current = '';
    }
    current += (current ? '\n\n' : '') + trimmed;
  }

  if (current) chunks.push({ text: current.trim(), title });
  return chunks.filter((c) => c.text.length >= minChars || chunks.length === 1);
}

async function main() {
  const { embedChunks } = await import('../src/lib/openai/embeddings');
  const { insertManualChunks } = await import('../src/lib/supabase/manual');
  const { supabase } = await import('../src/lib/supabase/client');

  const files = Object.keys(PDF_TO_PRODUCT);
  let totalChunks = 0;

  // Process one at a time to avoid hitting OpenAI rate limits
  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    if (i > 0) await new Promise((r) => setTimeout(r, 3000)); // 3s between files
    const filePath = join(PPL_DOCS, filename);
    const productId = PDF_TO_PRODUCT[filename];

    try {
      const text = await extractTextFromPdf(filePath);
      if (!text.trim()) {
        console.log(`  ⚠ ${filename}: No text extracted, skipping`);
        continue;
      }

      const chunks = chunkText(text);
      const chunkTexts = chunks.map((c) => c.text);
      const embeddings = await embedChunks(chunkTexts);

      const toInsert = chunks.map((c, i) => ({
        product_id: productId,
        chunk_title: c.title ?? null,
        chunk_text: c.text,
        source_ref: `${filename}${c.title ? ` ${c.title}` : ` chunk ${i + 1}`}`,
        embedding: embeddings[i] ?? [],
      }));

      await supabase.from('manual_chunks').delete().eq('product_id', productId);
      const { count } = await insertManualChunks(toInsert);
      totalChunks += count;
      console.log(`  ✓ ${filename} → ${productId}: ${count} chunks`);
    } catch (err) {
      console.error(`  ✗ ${filename}:`, err);
    }
  }

  console.log(`\nDone. Total chunks: ${totalChunks}`);
}

main().catch(console.error);
