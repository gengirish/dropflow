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
  RTO: "rto-queue",
  REORDER: "reorder-queue",
  RECONCILIATION: "reconciliation-queue",
  RETURNS: "returns-queue",
  CHANNEL_SYNC: "channel-sync-queue",
  SUPPLIER_SCORECARD: "supplier-scorecard-queue",
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const ANALYTICS = {
  GATEWAY_FEE_PERCENT: 2,
  RECOMPUTE_INTERVAL_HOURS: 1,
  DEFAULT_LOOKBACK_DAYS: 30,
} as const;

export const RTO = {
  HIGH_RISK_THRESHOLD: 70,
  MEDIUM_RISK_THRESHOLD: 40,
  LOW_RISK_THRESHOLD: 20,
  COD_PENALTY_SCORE: 25,
  LOW_PIN_DELIVERABILITY_THRESHOLD: 0.7,
  HIGH_ORDER_VALUE_THRESHOLD_PAISE: 300_000,
  REPEAT_BUYER_DISCOUNT: 15,
  PHONE_VERIFIED_DISCOUNT: 10,
  DEFAULT_RETURN_RESERVE_PERCENT: 5,
} as const;

export const MARGIN = {
  DEFAULT_PACKAGING_COST_PAISE: 2500,
  DEFAULT_RETURN_RESERVE_PERCENT: 5,
} as const;

export const CHANNEL = {
  DEFAULT_BUFFER_PERCENT: 100,
  SYNC_INTERVAL_MINUTES: 15,
} as const;

export const SUPPLIER_SCORECARD = {
  MIN_POS_FOR_SCORE: 3,
  ON_TIME_WEIGHT: 0.3,
  DEFECT_WEIGHT: 0.25,
  RETURN_WEIGHT: 0.25,
  LEAD_TIME_WEIGHT: 0.2,
  ALERT_THRESHOLD: 60,
} as const;

export const REORDER = {
  DEFAULT_SAFETY_STOCK_DAYS: 7,
  VELOCITY_LOOKBACK_DAYS: 30,
} as const;

export const RECONCILIATION = {
  TOLERANCE_PAISE: 100,
  AUTO_MATCH_WINDOW_DAYS: 7,
} as const;

export const RETURNS = {
  DEFAULT_RETURN_WINDOW_DAYS: 7,
  QC_SLA_HOURS: 48,
  REFUND_SLA_DAYS: 5,
  PREFIX: "RET",
} as const;

export const NOTIFICATION_TRIGGERS = {
  ORDER_CONFIRMED: "order.confirmed",
  ORDER_SHIPPED: "order.shipped",
  ORDER_OUT_FOR_DELIVERY: "order.out_for_delivery",
  ORDER_DELIVERED: "order.delivered",
  COD_TO_PREPAID_NUDGE: "order.cod_nudge",
  RETURN_INITIATED: "return.initiated",
  RETURN_PICKED_UP: "return.picked_up",
  REFUND_COMPLETED: "refund.completed",
  LOW_STOCK_ALERT: "inventory.low_stock",
  REORDER_ALERT: "inventory.reorder",
} as const;
