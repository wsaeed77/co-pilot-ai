import OpenAI from 'openai';

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY || 'sk-placeholder';
  return new OpenAI({ apiKey: key });
}

const EMBEDDING_MODEL = 'text-embedding-3-small';

export async function embedText(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

export async function embedChunks(chunks: string[]): Promise<number[][]> {
  if (chunks.length === 0) return [];
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: chunks,
  });
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}
