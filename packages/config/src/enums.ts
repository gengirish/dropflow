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
