import type { GSTINValidation } from "./types";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const CHECKSUM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar",
  "36": "Telangana",
  "37": "Andhra Pradesh",
};

export function validateGSTIN(gstin: string): GSTINValidation {
  if (typeof gstin !== "string" || gstin.length !== 15) {
    return { valid: false, stateCode: "", error: "GSTIN must be exactly 15 characters" };
  }

  const upper = gstin.toUpperCase();

  if (!GSTIN_REGEX.test(upper)) {
    return { valid: false, stateCode: "", error: "Invalid GSTIN format" };
  }

  const stateCode = upper.substring(0, 2);
  if (!(stateCode in STATE_CODES)) {
    return { valid: false, stateCode, error: `Invalid state code: ${stateCode}` };
  }

  // Mod-36 checksum validation
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const charIndex = CHECKSUM_CHARS.indexOf(upper[i]!);
    const factor = i % 2 === 0 ? 1 : 2;
    const product = charIndex * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const remainder = sum % 36;
  const expectedCheck = CHECKSUM_CHARS[(36 - remainder) % 36]!;

  if (upper[14] !== expectedCheck) {
    return { valid: false, stateCode, error: "Checksum mismatch" };
  }

  return { valid: true, stateCode };
}

export function getStateName(stateCode: string): string | undefined {
  return STATE_CODES[stateCode];
}
