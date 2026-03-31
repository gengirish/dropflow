export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const INVENTORY = {
  DEFAULT_LOW_STOCK_THRESHOLD: 10,
  DEFAULT_RESERVED_QTY: 0,
} as const;

export const RATE_LIMIT = {
  REQUESTS_PER_MINUTE: 100,
  WINDOW_MS: 60_000,
} as const;

export const WORKFLOW = {
  MAX_RETRIES: 3,
  BACKOFF_DELAY_MS: 2_000,
  QUEUE_CONCURRENCY: 5,
} as const;

export const GST = {
  VALID_RATES: [0, 3, 5, 12, 18, 28] as const,
  INVOICE_PREFIX: "INV",
  ORDER_PREFIX: "ORD",
  PO_PREFIX: "PO",
} as const;

export const QUEUE_NAMES = {
  ORDER: "order-queue",
  INVENTORY: "inventory-queue",
  INVOICE: "invoice-queue",
  SHIPPING: "shipping-queue",
  ANALYTICS: "analytics-queue",
  NOTIFICATION: "notification-queue",
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const ANALYTICS = {
  GATEWAY_FEE_PERCENT: 2,
  RECOMPUTE_INTERVAL_HOURS: 1,
  DEFAULT_LOOKBACK_DAYS: 30,
} as const;
