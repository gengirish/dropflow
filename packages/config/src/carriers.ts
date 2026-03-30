import { ShipmentCarrier } from "./enums";

interface CarrierInfo {
  code: ShipmentCarrier;
  displayName: string;
  isDomestic: boolean;
  isInternational: boolean;
}

export const CARRIERS: Record<ShipmentCarrier, CarrierInfo> = {
  SHIPROCKET: { code: "SHIPROCKET", displayName: "Shiprocket", isDomestic: true, isInternational: false },
  DELHIVERY: { code: "DELHIVERY", displayName: "Delhivery", isDomestic: true, isInternational: false },
  DTDC: { code: "DTDC", displayName: "DTDC", isDomestic: true, isInternational: false },
  BLUEDART: { code: "BLUEDART", displayName: "Blue Dart", isDomestic: true, isInternational: false },
  EASYPOST_DHL: { code: "EASYPOST_DHL", displayName: "DHL (via EasyPost)", isDomestic: false, isInternational: true },
  EASYPOST_FEDEX: { code: "EASYPOST_FEDEX", displayName: "FedEx (via EasyPost)", isDomestic: false, isInternational: true },
  EASYPOST_UPS: { code: "EASYPOST_UPS", displayName: "UPS (via EasyPost)", isDomestic: false, isInternational: true },
  SELF: { code: "SELF", displayName: "Self-Fulfilled", isDomestic: true, isInternational: true },
};

export function getDomesticCarriers(): CarrierInfo[] {
  return Object.values(CARRIERS).filter((c) => c.isDomestic);
}

export function getInternationalCarriers(): CarrierInfo[] {
  return Object.values(CARRIERS).filter((c) => c.isInternational);
}
