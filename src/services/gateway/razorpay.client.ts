import Razorpay from 'razorpay';
import { config } from '../../config.js';
import { logger } from '../../utils/logger.js';

// Initialize Razorpay in test mode
const razorpay = new Razorpay({
  key_id: config.RAZORPAY_KEY_ID,
  key_secret: config.RAZORPAY_KEY_SECRET,
});

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

/**
 * Create a Razorpay order (test mode).
 * Fails closed — any error results in rejection.
 */
export async function createOrder(params: {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const { amountPaise, currency = 'INR', receipt, notes = {} } = params;

  logger.info(
    { amount: amountPaise, currency, receipt },
    'Creating Razorpay order'
  );

  try {
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency,
      receipt,
      notes,
    });

    logger.info(
      { orderId: order.id, status: order.status },
      'Razorpay order created successfully'
    );

    return {
      id: order.id,
      amount: order.amount as number,
      currency: order.currency,
      receipt: order.receipt ?? receipt,
      status: order.status,
    };
  } catch (error: any) {
    logger.error(
      { err: error, receipt },
      'Razorpay order creation failed — failing closed'
    );

    throw new Error(
      `Razorpay API error: ${error?.error?.description || error?.message || 'Unknown error'}`
    );
  }
}
