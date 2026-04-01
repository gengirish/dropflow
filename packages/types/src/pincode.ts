import { z } from "zod";
import { PINCode } from "./common";

export const PincodeCheckInput = z.object({
  pincode: PINCode,
  weightGrams: z.number().int().positive().optional(),
  isCod: z.boolean().default(false),
});
export type PincodeCheckInput = z.infer<typeof PincodeCheckInput>;

export const CarrierOption = z.object({
  carrier: z.string(),
  carrierDisplayName: z.string(),
  isServiceable: z.boolean(),
  isCodAvailable: z.boolean(),
  estimatedDays: z.number().int().nullable(),
  ratePaise: z.number().int().nullable(),
  codChargePaise: z.number().int(),
  totalPaise: z.number().int().nullable(),
  zone: z.string().nullable(),
});
export type CarrierOption = z.infer<typeof CarrierOption>;

export const PincodeCheckResponse = z.object({
  pincode: z.string(),
  isServiceable: z.boolean(),
  isCodAvailable: z.boolean(),
  carriers: z.array(CarrierOption),
  cheapestCarrier: CarrierOption.nullable(),
  fastestCarrier: CarrierOption.nullable(),
  deliverability: z.object({
    deliveryRate: z.number(),
    avgDeliveryDays: z.number(),
    totalShipments: z.number().int(),
  }).nullable(),
});
export type PincodeCheckResponse = z.infer<typeof PincodeCheckResponse>;

export const BulkPincodeCheckInput = z.object({
  pincodes: z.array(PINCode).min(1).max(100),
});
export type BulkPincodeCheckInput = z.infer<typeof BulkPincodeCheckInput>;

export const CarrierRateInput = z.object({
  carrier: z.enum([
    "SHIPROCKET", "DELHIVERY", "DTDC", "BLUEDART", "ECOM_EXPRESS", "XPRESSBEES",
    "EASYPOST_DHL", "EASYPOST_FEDEX", "EASYPOST_UPS", "SELF",
  ]),
  zone: z.string().min(1),
  minWeightGrams: z.number().int().nonnegative(),
  maxWeightGrams: z.number().int().positive(),
  basePricePaise: z.number().int().nonnegative(),
  additionalPerGramPaise: z.number().nonnegative().default(0),
  codChargePaise: z.number().int().nonnegative().default(0),
  fuelSurchargePercent: z.number().nonnegative().default(0),
  validFrom: z.string(),
  validTo: z.string().optional(),
});
export type CarrierRateInput = z.infer<typeof CarrierRateInput>;
