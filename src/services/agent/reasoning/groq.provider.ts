import Groq from 'groq-sdk';
import { ReasoningProvider, ProductSelection } from './provider.interface.js';
import { Product } from '../../../db/schema.js';
import { config } from '../../../config.js';
import { logger } from '../../../utils/logger.js';

const SYSTEM_PROMPT = `You are a product selection agent. Your job is to analyze a list of products and select the BEST one that matches the user's goal.

RULES:
1. Only select products that are IN STOCK (stock > 0)
2. Only select products within the budget constraint if one is provided
3. Only select products from allowed categories if specified
4. Provide a clear, concise reason for your selection
5. Rate your confidence from 0 to 1
6. UPSELL ENGINE: If the user has enough remaining budget after selecting the primary product, you MUST also recommend one relevant accessory or add-on product that is in stock and fits the remaining budget.
7. STRICT REJECTION: If NO product in the allowed categories matches the user's actual goal (e.g. they ask for electronics, but only sports are allowed), you MUST return an empty JSON object: {} Do not attempt to guess or pick an unrelated product.

You MUST respond with ONLY a valid JSON object. Do NOT include comments in the JSON.
Format:
{
  "productId": "prod_XXX",
  "upsellProductId": "prod_YYY",
  "reason": "your reasoning here",
  "confidence": 0.95
}

(If no upsell is possible, omit the "upsellProductId" key entirely).
Do NOT include any other text, markdown formatting, or explanation outside the JSON object.`;

export class GroqReasoningProvider implements ReasoningProvider {
  readonly name = 'groq';
  private client: Groq;

  constructor() {
    this.client = new Groq({
      apiKey: config.GROQ_API_KEY,
    });
  }

  async selectProduct(
    goal: string,
    products: Product[],
    constraints?: {
      maxBudget?: number;
      allowedCategories?: string[];
    }
  ): Promise<ProductSelection> {
    if (products.length === 0) {
      throw new Error('No products available for selection');
    }

    // Filter to in-stock products first
    const availableProducts = products.filter((p) => p.stock > 0);
    if (availableProducts.length === 0) {
      throw new Error('No in-stock products available');
    }

    // Build the product catalog for the LLM
    const productList = availableProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: `₹${(p.priceInr / 100).toFixed(2)}`,
      priceInPaise: p.priceInr,
      stock: p.stock,
      description: p.description,
    }));

    const userMessage = this.buildUserMessage(goal, productList, constraints);

    logger.debug({ goal, productCount: availableProducts.length }, 'Groq: selecting product');

    // Attempt 1: strict JSON mode
    try {
      const result = await this.callGroq(userMessage, true);
      return this.validateResult(result, availableProducts);
    } catch (firstError: any) {
      logger.warn({ err: firstError.message }, 'Groq strict JSON mode failed — retrying with text mode');
    }

    // Attempt 2: text mode with manual JSON extraction (fallback)
    try {
      const result = await this.callGroq(userMessage, false);
      return this.validateResult(result, availableProducts);
    } catch (error: any) {
      logger.error({ err: error }, 'Groq reasoning failed on both attempts');
      throw new Error(`Groq reasoning error: ${error.message}`);
    }
  }

  private async callGroq(userMessage: string, strictJson: boolean): Promise<ProductSelection> {
    const completion = await this.client.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0,
      max_tokens: 1000,
      ...(strictJson ? { response_format: { type: 'json_object' as const } } : {}),
    });

    const content = completion.choices[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      throw new Error('Empty response from Groq');
    }

    // Extract JSON from response (handles markdown code fences)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    // Also try to find raw JSON object
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      jsonStr = braceMatch[0];
    }

    return JSON.parse(jsonStr) as ProductSelection;
  }

  private validateResult(parsed: ProductSelection, availableProducts: Product[]): ProductSelection {
    // Handle the case where the LLM returns {} because no product fits
    if (!parsed.productId && !parsed.reason && parsed.confidence == null) {
      throw new Error('No products match the given goal and budget constraints. Try increasing the mandate budget or broadening the allowed categories.');
    }

    if (parsed.productId === undefined || !parsed.reason || parsed.confidence == null) {
      throw new Error(`Invalid response structure: ${JSON.stringify(parsed)}`);
    }

    if (parsed.productId === null) {
      throw new Error(`Agent found no matching product: ${parsed.reason}`);
    }

    const selectedProduct = availableProducts.find((p) => p.id === parsed.productId);
    if (!selectedProduct) {
      throw new Error(`Agent selected invalid product ID: ${parsed.productId}`);
    }

    logger.info(
      { productId: parsed.productId, confidence: parsed.confidence, provider: 'groq' },
      `Product selected: ${parsed.reason}`
    );

    return parsed;
  }

  private buildUserMessage(
    goal: string,
    productList: Array<Record<string, unknown>>,
    constraints?: { maxBudget?: number; allowedCategories?: string[] }
  ): string {
    let message = `GOAL: ${goal}\n\nAVAILABLE PRODUCTS:\n${JSON.stringify(productList, null, 2)}`;

    if (constraints) {
      message += '\n\nCONSTRAINTS:';
      if (constraints.maxBudget) {
        message += `\n- Maximum budget: ₹${(constraints.maxBudget / 100).toFixed(2)}`;
      }
      if (constraints.allowedCategories && constraints.allowedCategories.length > 0) {
        message += `\n- Allowed categories: ${constraints.allowedCategories.join(', ')}`;
      }
    }

    return message;
  }
}
