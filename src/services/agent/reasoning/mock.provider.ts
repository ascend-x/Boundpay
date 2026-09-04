import { ReasoningProvider, ProductSelection } from './provider.interface.js';
import { Product } from '../../../db/schema.js';
import { logger } from '../../../utils/logger.js';

/**
 * Mock ReasoningProvider for testing.
 * Deterministically selects the cheapest in-stock product that matches constraints.
 */
export class MockReasoningProvider implements ReasoningProvider {
  readonly name = 'mock';

  async selectProduct(
    goal: string,
    products: Product[],
    constraints?: {
      maxBudget?: number;
      allowedCategories?: string[];
    }
  ): Promise<ProductSelection> {
    let candidates = products.filter((p) => p.stock > 0);

    if (constraints?.maxBudget) {
      candidates = candidates.filter((p) => p.priceInr <= constraints.maxBudget!);
    }

    if (constraints?.allowedCategories && constraints.allowedCategories.length > 0) {
      candidates = candidates.filter((p) =>
        constraints.allowedCategories!.includes(p.category)
      );
    }

    if (candidates.length === 0) {
      throw new Error('No products match the constraints');
    }

    // Select cheapest
    candidates.sort((a, b) => a.priceInr - b.priceInr);
    const selected = candidates[0];

    logger.debug({ productId: selected.id, provider: 'mock' }, 'Mock: selected cheapest product');

    return {
      productId: selected.id,
      reason: `[Mock] Selected "${selected.name}" as the cheapest option matching goal: "${goal}"`,
      confidence: 0.85,
    };
  }
}
