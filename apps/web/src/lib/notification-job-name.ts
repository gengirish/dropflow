import { NOTIFICATION_TRIGGERS } from "@dropflow/config";

/** BullMQ job name for the notification worker, derived from trigger event. */
export function notificationJobNameForTrigger(triggerEvent: string): string {
	if (triggerEvent === NOTIFICATION_TRIGGERS.ORDER_CONFIRMED) {
		return "order-confirmation";
	}
	if (
		triggerEvent === NOTIFICATION_TRIGGERS.ORDER_SHIPPED ||
		triggerEvent === NOTIFICATION_TRIGGERS.ORDER_OUT_FOR_DELIVERY
	) {
		return "shipment-update";
	}
	if (triggerEvent === NOTIFICATION_TRIGGERS.ORDER_DELIVERED) {
		return "delivery-complete";
	}
	if (triggerEvent === NOTIFICATION_TRIGGERS.COD_TO_PREPAID_NUDGE) {
		return "cod-nudge";
	}
	if (
		triggerEvent === NOTIFICATION_TRIGGERS.RETURN_INITIATED ||
		triggerEvent === NOTIFICATION_TRIGGERS.RETURN_PICKED_UP
	) {
		return "return-update";
	}
	if (triggerEvent === NOTIFICATION_TRIGGERS.REFUND_COMPLETED) {
		return "refund-update";
	}
	return "generic";
}
