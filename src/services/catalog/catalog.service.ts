import { db } from '../../db/index.js';
import { products, Product } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';

/**
 * Get all products, optionally filtered by category.
 */
export async function listProducts(category?: string): Promise<Product[]> {
  if (category) {
    logger.debug({ category }, 'Listing products by category');
    return db.select().from(products).where(eq(products.category, category));
  }

  logger.debug('Listing all products');
  return db.select().from(products);
}

/**
 * Get a single product by ID.
 */
export async function getProductById(id: string): Promise<Product | null> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  return product ?? null;
}

/**
 * Check if a product has available stock.
 */
export async function hasStock(id: string): Promise<boolean> {
  const product = await getProductById(id);
  return product !== null && product.stock > 0;
}
