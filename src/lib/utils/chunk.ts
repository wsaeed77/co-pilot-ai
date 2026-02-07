/**
 * Chunk text into sections of ~300-800 tokens (roughly 225-600 words).
 * Simple sentence-boundary splitting.
 */
export function chunkText(
  text: string,
  options: { minChars?: number; maxChars?: number } = {}
): Array<{ text: string; title?: string }> {
  const { minChars = 400, maxChars = 2400 } = options;
  const chunks: Array<{ text: string; title?: string }> = [];
  const paragraphs = text.split(/\n\n+/);

  let current = '';
  let title: string | undefined;

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    // Detect section headers (simple heuristic)
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

  if (current) {
    chunks.push({ text: current.trim(), title });
  }

  return chunks.filter((c) => c.text.length >= minChars || chunks.length === 1);
}
