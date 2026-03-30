import type { HSNEntry } from "./types";

const HSN_MAP: Record<string, HSNEntry> = {
  "0902": { code: "0902", description: "Tea", ratePercent: 5 },
  "1006": { code: "1006", description: "Rice", ratePercent: 5 },
  "1905": { code: "1905", description: "Bread, pastry, cakes, biscuits", ratePercent: 18 },
  "2201": { code: "2201", description: "Mineral water, aerated water", ratePercent: 18 },
  "3004": { code: "3004", description: "Medicaments, packaged", ratePercent: 12 },
  "3304": { code: "3304", description: "Beauty, make-up, skin care preparations", ratePercent: 28 },
  "3305": { code: "3305", description: "Hair care preparations", ratePercent: 18 },
  "3306": { code: "3306", description: "Oral hygiene preparations", ratePercent: 18 },
  "3401": { code: "3401", description: "Soap, organic surface-active products", ratePercent: 18 },
  "3402": { code: "3402", description: "Washing and cleaning preparations", ratePercent: 18 },
  "4202": { code: "4202", description: "Trunks, suit-cases, handbags", ratePercent: 18 },
  "4901": { code: "4901", description: "Printed books, brochures", ratePercent: 0 },
  "6103": { code: "6103", description: "Men's suits, jackets, trousers, knitted", ratePercent: 12 },
  "6104": { code: "6104", description: "Women's suits, dresses, skirts, knitted", ratePercent: 12 },
  "6109": { code: "6109", description: "T-shirts, singlets and other vests, knitted", ratePercent: 5 },
  "6110": { code: "6110", description: "Jerseys, pullovers, cardigans, knitted", ratePercent: 12 },
  "6203": { code: "6203", description: "Men's suits, jackets, trousers, woven", ratePercent: 12 },
  "6204": { code: "6204", description: "Women's suits, dresses, skirts, woven", ratePercent: 12 },
  "6205": { code: "6205", description: "Men's shirts, woven", ratePercent: 12 },
  "6206": { code: "6206", description: "Women's blouses, shirts, woven", ratePercent: 12 },
  "6403": { code: "6403", description: "Footwear with outer soles of rubber/plastic", ratePercent: 18 },
  "6404": { code: "6404", description: "Footwear with textile uppers", ratePercent: 12 },
  "7113": { code: "7113", description: "Articles of jewellery and parts thereof", ratePercent: 3 },
  "7117": { code: "7117", description: "Imitation jewellery", ratePercent: 12 },
  "8471": { code: "8471", description: "Automatic data processing machines (laptops)", ratePercent: 18 },
  "8504": { code: "8504", description: "Electrical transformers, chargers", ratePercent: 18 },
  "8517": { code: "8517", description: "Telephone sets, smartphones", ratePercent: 12 },
  "8518": { code: "8518", description: "Microphones, loudspeakers, headphones", ratePercent: 18 },
  "8528": { code: "8528", description: "Monitors, projectors, televisions", ratePercent: 28 },
  "9503": { code: "9503", description: "Toys, scale models, puzzles", ratePercent: 12 },
  "9506": { code: "9506", description: "Sports equipment", ratePercent: 12 },
  "9613": { code: "9613", description: "Lighters", ratePercent: 28 },
};

export function getHSNRate(hsnCode: string): HSNEntry {
  const fourDigit = hsnCode.substring(0, 4);
  const entry = HSN_MAP[fourDigit];
  if (!entry) {
    throw new Error(`Unknown HSN code: ${hsnCode} (looked up ${fourDigit})`);
  }
  return entry;
}

export function isValidHSNCode(hsnCode: string): boolean {
  const fourDigit = hsnCode.substring(0, 4);
  return fourDigit in HSN_MAP;
}
