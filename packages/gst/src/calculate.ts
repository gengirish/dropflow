import type { GSTParams, GSTBreakdown } from "./types";
import { getHSNRate } from "./hsn-map";

export function calculateGST(params: GSTParams): GSTBreakdown {
  const { subtotalPaise, hsnCode, sellerStateCode, buyerStateCode, isExport } = params;

  if (!Number.isInteger(subtotalPaise) || subtotalPaise < 0) {
    throw new Error("subtotalPaise must be a non-negative integer");
  }

  const hsnEntry = getHSNRate(hsnCode);
  const rate = hsnEntry.ratePercent;

  // Export with Letter of Undertaking: zero tax
  if (isExport) {
    return {
      gstType: "EXPORT_LUT",
      gstRatePercent: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      totalTaxPaise: 0,
      totalWithTaxPaise: subtotalPaise,
      hsnCode,
      hsnDescription: hsnEntry.description,
    };
  }

  // Exempt goods (0% rate)
  if (rate === 0) {
    return {
      gstType: "EXEMPT",
      gstRatePercent: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      totalTaxPaise: 0,
      totalWithTaxPaise: subtotalPaise,
      hsnCode,
      hsnDescription: hsnEntry.description,
    };
  }

  // Intra-state: CGST + SGST (split 50/50)
  if (buyerStateCode !== null && sellerStateCode === buyerStateCode) {
    const totalTaxPaise = Math.round((subtotalPaise * rate) / 100);
    const cgstPaise = Math.floor(totalTaxPaise / 2);
    const sgstPaise = totalTaxPaise - cgstPaise;

    return {
      gstType: "CGST_SGST",
      gstRatePercent: rate,
      cgstPaise,
      sgstPaise,
      igstPaise: 0,
      totalTaxPaise,
      totalWithTaxPaise: subtotalPaise + totalTaxPaise,
      hsnCode,
      hsnDescription: hsnEntry.description,
    };
  }

  // Inter-state: IGST (full rate)
  const igstPaise = Math.round((subtotalPaise * rate) / 100);

  return {
    gstType: "IGST",
    gstRatePercent: rate,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise,
    totalTaxPaise: igstPaise,
    totalWithTaxPaise: subtotalPaise + igstPaise,
    hsnCode,
    hsnDescription: hsnEntry.description,
  };
}
