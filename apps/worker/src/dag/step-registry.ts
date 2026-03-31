import type { StepFunction } from "./types";
import { validateStock } from "./steps/validate-stock";
import { routeToSupplier } from "./steps/route-to-supplier";
import { generatePO } from "./steps/generate-po";
import { createShipment } from "./steps/create-shipment";
import { notifyBuyer } from "./steps/notify-buyer";

const STEP_REGISTRY: Record<string, StepFunction> = {
  "validate-stock": validateStock,
  "route-to-supplier": routeToSupplier,
  "generate-po": generatePO,
  "create-shipment": createShipment,
  "notify-buyer": notifyBuyer,
};

export function getStepHandler(handlerName: string): StepFunction | undefined {
  return STEP_REGISTRY[handlerName];
}

export function getAvailableSteps(): string[] {
  return Object.keys(STEP_REGISTRY);
}
