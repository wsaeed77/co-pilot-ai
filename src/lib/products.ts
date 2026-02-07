import type { ProductConfig } from '@/lib/openai/types';

const productCache: Record<string, ProductConfig> = {};

export async function getProduct(productId: string): Promise<ProductConfig> {
  if (productCache[productId]) return productCache[productId];

  const fs = await import('fs/promises');
  const path = await import('path');
  const filePath = path.join(process.cwd(), 'data', 'products', `${productId}.json`);
  const content = await fs.readFile(filePath, 'utf-8');
  const product = JSON.parse(content) as ProductConfig;
  productCache[productId] = product;
  return product;
}
