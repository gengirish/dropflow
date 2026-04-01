import { createQueue } from "../lib/redis";
import { QUEUE_NAMES } from "@dropflow/config";

export const orderQueue = createQueue(QUEUE_NAMES.ORDER);
export const inventoryQueue = createQueue(QUEUE_NAMES.INVENTORY);
export const invoiceQueue = createQueue(QUEUE_NAMES.INVOICE);
export const shippingQueue = createQueue(QUEUE_NAMES.SHIPPING);
export const analyticsQueue = createQueue(QUEUE_NAMES.ANALYTICS);
export const notificationQueue = createQueue(QUEUE_NAMES.NOTIFICATION);
export const rtoQueue = createQueue(QUEUE_NAMES.RTO);
export const channelSyncQueue = createQueue(QUEUE_NAMES.CHANNEL_SYNC);
export const supplierScorecardQueue = createQueue(QUEUE_NAMES.SUPPLIER_SCORECARD);
export const reorderQueue = createQueue(QUEUE_NAMES.REORDER);
export const returnsQueue = createQueue(QUEUE_NAMES.RETURNS);
export const reconciliationQueue = createQueue(QUEUE_NAMES.RECONCILIATION);

export const allQueues = {
  [QUEUE_NAMES.ORDER]: orderQueue,
  [QUEUE_NAMES.INVENTORY]: inventoryQueue,
  [QUEUE_NAMES.INVOICE]: invoiceQueue,
  [QUEUE_NAMES.SHIPPING]: shippingQueue,
  [QUEUE_NAMES.ANALYTICS]: analyticsQueue,
  [QUEUE_NAMES.NOTIFICATION]: notificationQueue,
  [QUEUE_NAMES.RTO]: rtoQueue,
  [QUEUE_NAMES.CHANNEL_SYNC]: channelSyncQueue,
  [QUEUE_NAMES.SUPPLIER_SCORECARD]: supplierScorecardQueue,
  [QUEUE_NAMES.REORDER]: reorderQueue,
  [QUEUE_NAMES.RETURNS]: returnsQueue,
  [QUEUE_NAMES.RECONCILIATION]: reconciliationQueue,
};
