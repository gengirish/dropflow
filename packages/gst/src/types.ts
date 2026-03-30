export interface GSTParams {
  subtotalPaise: number;
  hsnCode: string;
  sellerStateCode: string;
  buyerStateCode: string | null;
  isExport: boolean;
}

export type GSTTypeName = "CGST_SGST" | "IGST" | "EXPORT_LUT" | "EXEMPT";

export interface GSTBreakdown {
  gstType: GSTTypeName;
  gstRatePercent: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  totalWithTaxPaise: number;
  hsnCode: string;
  hsnDescription: string;
}

export interface HSNEntry {
  code: string;
  description: string;
  ratePercent: number;
}

export interface GSTINValidation {
  valid: boolean;
  stateCode: string;
  error?: string;
}
