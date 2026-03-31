import { createQueue } from "../lib/redis";
import { QUEUE_NAMES } from "@dropflow/config";

export const orderQueue = createQueue(QUEUE_NAMES.ORDER);
export const inventoryQueue = createQueue(QUEUE_NAMES.INVENTORY);
export const invoiceQueue = createQueue(QUEUE_NAMES.INVOICE);
export const shippingQueue = createQueue(QUEUE_NAMES.SHIPPING);
export const analyticsQueue = createQueue(QUEUE_NAMES.ANALYTICS);
export const notificationQueue = createQueue(QUEUE_NAMES.NOTIFICATION);

export const allQueues = {
  [QUEUE_NAMES.ORDER]: orderQueue,
  [QUEUE_NAMES.INVENTORY]: inventoryQueue,
  [QUEUE_NAMES.INVOICE]: invoiceQueue,
  [QUEUE_NAMES.SHIPPING]: shippingQueue,
  [QUEUE_NAMES.ANALYTICS]: analyticsQueue,
  [QUEUE_NAMES.NOTIFICATION]: notificationQueue,
};
