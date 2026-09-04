import { listProducts } from '../catalog/catalog.service.js';
import { getMandateById } from '../mandate/mandate.service.js';
import { processPurchase, PurchaseResult } from '../gateway/gateway.service.js';
import { ReasoningProvider, ProductSelection } from './reasoning/provider.interface.js';
import { GroqReasoningProvider } from './reasoning/groq.provider.js';
import { MockReasoningProvider } from './reasoning/mock.provider.js';
import { logger } from '../../utils/logger.js';
import { BusinessError } from '../../middleware/error-handler.js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config.js';
import { Product } from '../../db/schema.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface AgentGoal {
  buyerId: string;
  mandateId: string;
  goal: string;
}

export interface AgentResult {
  goal: string;
  steps: AgentStep[];
  selection?: ProductSelection;
  purchaseResults?: PurchaseResult[];
  finalStatus: 'success' | 'rejected' | 'failed' | 'no_match' | 'partial_success';
  summary: string;
}

export interface AgentStep {
  step: number;
  action: string;
  detail: string;
  timestamp: string;
}

// ─── Provider Factory ────────────────────────────────────────────────

let provider: ReasoningProvider | null = null;

export function getReasoningProvider(): ReasoningProvider {
  if (!provider) {
    try {
      provider = new GroqReasoningProvider();
      logger.info('Using Groq reasoning provider');
    } catch {
      logger.warn('Groq provider unavailable, falling back to mock');
      provider = new MockReasoningProvider();
    }
  }
  return provider;
}

// ─── Agent Service ───────────────────────────────────────────────────

/**
 * Execute a buyer agent goal.
 * Flow: fetch mandate → query catalog → LLM reasoning → gateway purchase
 */
export async function executeGoal(input: AgentGoal): Promise<AgentResult> {
  const { buyerId, mandateId, goal } = input;
  const steps: AgentStep[] = [];
  let stepNum = 0;

  const addStep = (action: string, detail: string) => {
    steps.push({
      step: ++stepNum,
      action,
      detail,
      timestamp: new Date().toISOString(),
    });
  };

  logger.info({ buyerId, mandateId, goal }, 'Agent: executing goal');

  // Step 1: Fetch mandate to understand constraints
  addStep('fetch_mandate', `Fetching mandate ${mandateId}`);
  const mandate = await getMandateById(mandateId);

  if (!mandate) {
    addStep('error', `Mandate ${mandateId} not found`);
    return {
      goal,
      steps,
      finalStatus: 'failed',
      summary: `Cannot proceed — mandate ${mandateId} not found.`,
    };
  }

  if (mandate.buyerId !== buyerId) {
    addStep('error', 'Mandate does not belong to this buyer');
    return {
      goal,
      steps,
      finalStatus: 'failed',
      summary: 'Cannot proceed — mandate does not belong to this buyer.',
    };
  }

  addStep('mandate_loaded', `Mandate loaded. Max spend: ₹${((mandate.maxSpendInr - mandate.amountSpent) / 100).toFixed(2)} remaining, categories: ${(mandate.allowedCategories as string[]).join(', ')}`);

  // Step 2: Query catalog
  addStep('query_catalog', 'Fetching product catalog');
  const allProducts = await listProducts();
  addStep('catalog_loaded', `Found ${allProducts.length} products in catalog`);

  // Pre-filter to relevant categories for the LLM
  const allowedCategories = mandate.allowedCategories as string[];
  const relevantProducts = allProducts.filter((p) =>
    allowedCategories.includes(p.category) && p.stock > 0
  );

  if (relevantProducts.length === 0) {
    addStep('no_match', 'No in-stock products match mandate categories');
    return {
      goal,
      steps,
      finalStatus: 'no_match',
      summary: `No products available in categories [${allowedCategories.join(', ')}] with stock.`,
    };
  }

  addStep('filtered', `${relevantProducts.length} products match mandate categories and are in stock`);

  // Step 3: LLM reasoning — select a product
  const reasoningProvider = getReasoningProvider();
  addStep('reasoning', `Using ${reasoningProvider.name} provider to select product`);

  let selection: ProductSelection;
  try {
    selection = await reasoningProvider.selectProduct(goal, relevantProducts, {
      maxBudget: mandate.maxSpendInr - mandate.amountSpent,
      allowedCategories,
    });
  } catch (error: any) {
    addStep('reasoning_failed', error.message);
    return {
      goal,
      steps,
      finalStatus: 'failed',
      summary: `Agent reasoning failed: ${error.message}`,
    };
  }

  addStep('product_selected', `Selected: ${selection.productId} (confidence: ${selection.confidence}). Reason: ${selection.reason}`);

  const purchaseResults: PurchaseResult[] = [];
  let summary = '';
  let finalStatus: AgentResult['finalStatus'] = 'success';

  // Helper to process a single item
  const processItem = async (prodId: string, isUpsell: boolean) => {
    const prod = relevantProducts.find((p) => p.id === prodId);
    if (!prod) {
      addStep('error', `Selected ${isUpsell ? 'upsell ' : ''}product ${prodId} not found`);
      return false;
    }

    addStep('purchase_request', `Submitting ${isUpsell ? 'upsell ' : ''}purchase: ${prod.name} at ₹${(prod.priceInr / 100).toFixed(2)}`);
    const idempotencyKey = uuidv4();
    const result = await processPurchase({
      mandateId,
      buyerId,
      productId: prodId,
      requestedAmount: prod.priceInr,
      agentReasoning: isUpsell ? `[UPSELL] ${selection.reason}` : selection.reason,
      idempotencyKey,
    });

    addStep('gateway_response', `Gateway decision for ${prod.name}: ${result.status} — ${result.reason}`);
    purchaseResults.push(result);

    if (result.status === 'approved') {
      summary += `✅ Purchased "${prod.name}" for ₹${(prod.priceInr / 100).toFixed(2)} (Order: ${result.orderId}).\n`;
    } else {
      summary += `❌ Failed to purchase "${prod.name}": ${result.reason}\n`;
      finalStatus = isUpsell && finalStatus === 'success' ? 'partial_success' : result.status as any;
    }
    return result.status === 'approved';
  };

  // Process Primary
  const primarySuccess = await processItem(selection.productId, false);

  // Process Upsell if primary succeeded and upsell exists
  if (primarySuccess && selection.upsellProductId) {
    addStep('upsell_triggered', `Agent recommended upsell product: ${selection.upsellProductId}`);
    await processItem(selection.upsellProductId, true);
  }

  return {
    goal,
    steps,
    selection,
    purchaseResults,
    finalStatus,
    summary: summary.trim(),
  };
}
