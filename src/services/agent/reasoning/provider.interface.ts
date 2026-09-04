import { Product } from '../../../db/schema.js';

/**
 * ReasoningProvider interface — the abstraction that makes the LLM provider swappable.
 * Any provider implementing this interface can be used by the Buyer Agent
 * without changing agent logic.
 */
export interface ReasoningProvider {
  /**
   * Given a natural-language goal and a list of available products,
   * select the best product and provide a reason for the selection.
   */
  selectProduct(
    goal: string,
    products: Product[],
    constraints?: {
      maxBudget?: number; // in paise
      allowedCategories?: string[];
    }
  ): Promise<ProductSelection>;

  /**
   * Provider name for logging/debugging.
   */
  readonly name: string;
}

export interface ProductSelection {
  productId: string;
  upsellProductId?: string;
  reason: string;
  confidence: number; // 0-1
}
