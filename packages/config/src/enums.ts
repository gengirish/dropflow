export const TenantPlan = {
  STARTER: "STARTER",
  GROWTH: "GROWTH",
  ENTERPRISE: "ENTERPRISE",
} as const;
export type TenantPlan = (typeof TenantPlan)[keyof typeof TenantPlan];

export const Currency = {
  INR: "INR",
  USD: "USD",
  EUR: "EUR",
  GBP: "GBP",
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const UserRole = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  STAFF: "STAFF",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SupplierStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;
export type SupplierStatus = (typeof SupplierStatus)[keyof typeof SupplierStatus];

export const OrderStatus = {
  PENDING: "PENDING",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  ROUTING: "ROUTING",
  PO_CREATED: "PO_CREATED",
  SUPPLIER_CONFIRMED: "SUPPLIER_CONFIRMED",
  PROCESSING: "PROCESSING",
  SHIPPED: "SHIPPED",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  RETURN_REQUESTED: "RETURN_REQUESTED",
  RETURNED: "RETURNED",
  REFUNDED: "REFUNDED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const GSTType = {
  CGST_SGST: "CGST_SGST",
  IGST: "IGST",
  EXPORT_LUT: "EXPORT_LUT",
  EXEMPT: "EXEMPT",
} as const;
export type GSTType = (typeof GSTType)[keyof typeof GSTType];

export const WorkflowStatus = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  ARCHIVED: "ARCHIVED",
} as const;
export type WorkflowStatus = (typeof WorkflowStatus)[keyof typeof WorkflowStatus];

export const WorkflowRunStatus = {
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  PAUSED: "PAUSED",
  CANCELLED: "CANCELLED",
} as const;
export type WorkflowRunStatus = (typeof WorkflowRunStatus)[keyof typeof WorkflowRunStatus];

export const ShipmentCarrier = {
  SHIPROCKET: "SHIPROCKET",
  DELHIVERY: "DELHIVERY",
  DTDC: "DTDC",
  BLUEDART: "BLUEDART",
  ECOM_EXPRESS: "ECOM_EXPRESS",
  XPRESSBEES: "XPRESSBEES",
  EASYPOST_DHL: "EASYPOST_DHL",
  EASYPOST_FEDEX: "EASYPOST_FEDEX",
  EASYPOST_UPS: "EASYPOST_UPS",
  SELF: "SELF",
} as const;
export type ShipmentCarrier = (typeof ShipmentCarrier)[keyof typeof ShipmentCarrier];

export const NotificationChannel = {
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
  SMS: "SMS",
  IN_APP: "IN_APP",
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const PaymentGateway = {
  RAZORPAY: "RAZORPAY",
  STRIPE: "STRIPE",
} as const;
export type PaymentGateway = (typeof PaymentGateway)[keyof typeof PaymentGateway];

export const PaymentStatus = {
  CREATED: "CREATED",
  CAPTURED: "CAPTURED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const POStatus = {
  SENT: "SENT",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  FULFILLED: "FULFILLED",
  CANCELLED: "CANCELLED",
} as const;
export type POStatus = (typeof POStatus)[keyof typeof POStatus];

export const AnalyticsGranularity = {
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
} as const;
export type AnalyticsGranularity = (typeof AnalyticsGranularity)[keyof typeof AnalyticsGranularity];

export const WorkflowNodeType = {
  ACTION: "action",
  CONDITION: "condition",
  DELAY: "delay",
  WEBHOOK: "webhook",
  APPROVAL: "approval",
} as const;
export type WorkflowNodeType = (typeof WorkflowNodeType)[keyof typeof WorkflowNodeType];

export const PaymentMethod = {
  COD: "COD",
  PREPAID: "PREPAID",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const RtoRiskLevel = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type RtoRiskLevel = (typeof RtoRiskLevel)[keyof typeof RtoRiskLevel];

export const SalesChannelType = {
  WEBSITE: "WEBSITE",
  AMAZON: "AMAZON",
  FLIPKART: "FLIPKART",
  MEESHO: "MEESHO",
  MYNTRA: "MYNTRA",
  SHOPIFY: "SHOPIFY",
  CUSTOM: "CUSTOM",
} as const;
export type SalesChannelType = (typeof SalesChannelType)[keyof typeof SalesChannelType];

export const ChannelSyncStatus = {
  CONNECTED: "CONNECTED",
  DISCONNECTED: "DISCONNECTED",
  SYNCING: "SYNCING",
  ERROR: "ERROR",
  PAUSED: "PAUSED",
} as const;
export type ChannelSyncStatus = (typeof ChannelSyncStatus)[keyof typeof ChannelSyncStatus];

export const ReturnStatus = {
  REQUESTED: "REQUESTED",
  APPROVED: "APPROVED",
  PICKUP_SCHEDULED: "PICKUP_SCHEDULED",
  PICKED_UP: "PICKED_UP",
  RECEIVED: "RECEIVED",
  QC_PASSED: "QC_PASSED",
  QC_FAILED: "QC_FAILED",
  RESTOCKED: "RESTOCKED",
  DISPOSED: "DISPOSED",
  REFUND_INITIATED: "REFUND_INITIATED",
  REFUND_COMPLETED: "REFUND_COMPLETED",
  REJECTED: "REJECTED",
} as const;
export type ReturnStatus = (typeof ReturnStatus)[keyof typeof ReturnStatus];

export const ReturnReason = {
  DEFECTIVE: "DEFECTIVE",
  WRONG_ITEM: "WRONG_ITEM",
  SIZE_ISSUE: "SIZE_ISSUE",
  DAMAGED_IN_TRANSIT: "DAMAGED_IN_TRANSIT",
  NOT_AS_DESCRIBED: "NOT_AS_DESCRIBED",
  CHANGED_MIND: "CHANGED_MIND",
  OTHER: "OTHER",
} as const;
export type ReturnReason = (typeof ReturnReason)[keyof typeof ReturnReason];

export const RefundMethod = {
  ORIGINAL_PAYMENT: "ORIGINAL_PAYMENT",
  STORE_CREDIT: "STORE_CREDIT",
  BANK_TRANSFER: "BANK_TRANSFER",
} as const;
export type RefundMethod = (typeof RefundMethod)[keyof typeof RefundMethod];

export const RefundStatus = {
  INITIATED: "INITIATED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus];

export const ReconciliationStatus = {
  MATCHED: "MATCHED",
  UNMATCHED: "UNMATCHED",
  DISCREPANCY: "DISCREPANCY",
  MANUAL_OVERRIDE: "MANUAL_OVERRIDE",
} as const;
export type ReconciliationStatus = (typeof ReconciliationStatus)[keyof typeof ReconciliationStatus];

export const ReconciliationType = {
  PAYMENT_GATEWAY: "PAYMENT_GATEWAY",
  COD_CARRIER: "COD_CARRIER",
  SUPPLIER_INVOICE: "SUPPLIER_INVOICE",
} as const;
export type ReconciliationType = (typeof ReconciliationType)[keyof typeof ReconciliationType];

export const InventoryTxnType = {
  SALE: "SALE",
  RETURN: "RETURN",
  ADJUSTMENT: "ADJUSTMENT",
  RESTOCK: "RESTOCK",
  TRANSFER: "TRANSFER",
  RESERVE: "RESERVE",
  RELEASE: "RELEASE",
} as const;
export type InventoryTxnType = (typeof InventoryTxnType)[keyof typeof InventoryTxnType];

export const IncidentType = {
  LATE_DELIVERY: "LATE_DELIVERY",
  DEFECT: "DEFECT",
  WRONG_ITEM: "WRONG_ITEM",
  SHORT_SHIPMENT: "SHORT_SHIPMENT",
  QUALITY_ISSUE: "QUALITY_ISSUE",
} as const;
export type IncidentType = (typeof IncidentType)[keyof typeof IncidentType];

export const IncidentSeverity = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type IncidentSeverity = (typeof IncidentSeverity)[keyof typeof IncidentSeverity];
