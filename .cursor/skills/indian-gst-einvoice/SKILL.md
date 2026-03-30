---
name: indian-gst-einvoice
description: >-
  Indian GST calculation engine, GSTIN validation, and e-Invoice IRP integration
  for DropFlow. Use when working with GST logic in packages/gst/, validating
  GSTINs, calculating tax breakdowns, or submitting e-Invoices to IRP.
---

# Indian GST + e-Invoice — DropFlow

Location: `packages/gst/`

## GST Calculation (src/calculate.ts)

```typescript
import { GSTParams, GSTBreakdown } from "./types";
import { getHSNRate } from "./hsn-map";

export function calculateGST(params: GSTParams): GSTBreakdown {
  const { subtotalPaise, hsnCode, sellerStateCode, buyerStateCode, isExport } = params;
  const hsnEntry = getHSNRate(hsnCode);
  const rate = hsnEntry.ratePercent;

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

  if (sellerStateCode === buyerStateCode) {
    // Intra-state: CGST + SGST (split 50/50)
    const halfRate = rate / 2;
    const cgstPaise = Math.round((subtotalPaise * halfRate) / 100);
    const sgstPaise = Math.round((subtotalPaise * halfRate) / 100);
    const totalTaxPaise = cgstPaise + sgstPaise;

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
```

## HSN Code Map (src/hsn-map.ts)

Seed with common e-commerce HSN codes:

```typescript
interface HSNEntry {
  code: string;
  description: string;
  ratePercent: number; // 0, 5, 12, 18, 28
}

const HSN_MAP: Record<string, HSNEntry> = {
  "6109": { code: "6109", description: "T-shirts, singlets and other vests, knitted", ratePercent: 5 },
  "6110": { code: "6110", description: "Jerseys, pullovers, cardigans, knitted", ratePercent: 12 },
  "6204": { code: "6204", description: "Women's suits, dresses, skirts, woven", ratePercent: 12 },
  "6403": { code: "6403", description: "Footwear with outer soles of rubber/plastic", ratePercent: 18 },
  "8471": { code: "8471", description: "Automatic data processing machines (laptops, computers)", ratePercent: 18 },
  "8517": { code: "8517", description: "Telephone sets, smartphones", ratePercent: 12 },
  "3304": { code: "3304", description: "Beauty or make-up preparations", ratePercent: 28 },
  "3401": { code: "3401", description: "Soap, organic surface-active products", ratePercent: 18 },
  "4202": { code: "4202", description: "Trunks, suit-cases, handbags", ratePercent: 18 },
  "7113": { code: "7113", description: "Articles of jewellery and parts thereof", ratePercent: 3 },
  "0902": { code: "0902", description: "Tea", ratePercent: 5 },
  "1006": { code: "1006", description: "Rice", ratePercent: 5 },
  "3304": { code: "3304", description: "Beauty, make-up, skin care preparations", ratePercent: 28 },
  // Add more as needed
};

export function getHSNRate(code: string): HSNEntry {
  const entry = HSN_MAP[code.substring(0, 4)]; // Match first 4 digits
  if (!entry) throw new Error(`Unknown HSN code: ${code}`);
  return entry;
}
```

## GSTIN Validation (src/validate-gstin.ts)

```typescript
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const CHECKSUM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function validateGSTIN(gstin: string): { valid: boolean; stateCode: string; error?: string } {
  if (!GSTIN_REGEX.test(gstin)) {
    return { valid: false, stateCode: "", error: "Invalid GSTIN format" };
  }

  const stateCode = gstin.substring(0, 2);
  const stateNum = parseInt(stateCode, 10);
  if (stateNum < 1 || stateNum > 37) {
    return { valid: false, stateCode, error: "Invalid state code" };
  }

  // Mod-36 checksum validation
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const charIndex = CHECKSUM_CHARS.indexOf(gstin[i]);
    const factor = i % 2 === 0 ? 1 : 2;
    const product = charIndex * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const expectedCheck = CHECKSUM_CHARS[(36 - (sum % 36)) % 36];

  if (gstin[14] !== expectedCheck) {
    return { valid: false, stateCode, error: "Checksum mismatch" };
  }

  return { valid: true, stateCode };
}
```

## Indian State Codes

```typescript
export const STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam",
  "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
  "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman & Nicobar", "36": "Telangana",
  "37": "Andhra Pradesh",
};
```

## e-Invoice IRP Integration (Custom — No OSS Library)

Build a typed wrapper around the NIC/IRP REST API:

```typescript
// integrations/irp.ts (in worker)

const IRP_BASE_URL = "https://einv-apisandbox.nic.in"; // sandbox
// Production: https://einv-api.nic.in

interface IRPAuthResponse {
  AuthToken: string;
  TokenExpiry: string;
}

export async function authenticateIRP(gstin: string): Promise<string> {
  const res = await fetch(`${IRP_BASE_URL}/eivital/v1.04/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "gstin": gstin,
      "user_name": env.IRP_USERNAME,
      "password": env.IRP_PASSWORD,
    },
  });
  const data: IRPAuthResponse = await res.json();
  return data.AuthToken;
}

export async function generateIRN(token: string, invoicePayload: object) {
  const res = await fetch(`${IRP_BASE_URL}/eicore/v1.03/Invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "AuthToken": token,
    },
    body: JSON.stringify(invoicePayload),
  });
  return res.json(); // { AckNo, AckDt, Irn, SignedInvoice, SignedQRCode }
}
```

## Conventions

- All arithmetic in integer paise — never use floating-point for money
- `Math.round()` for CGST/SGST 50/50 split on odd amounts
- CGST+SGST total must exactly equal the full-rate amount (rounding goes to SGST)
- HSN map lookup uses first 4 digits of HSN code
- GSTIN checksum uses mod-36 algorithm — validate before storing
- e-Invoice IRP: use sandbox URL during development, switch to production in env
- 100% unit test coverage required for `calculateGST()` and `validateGSTIN()`
