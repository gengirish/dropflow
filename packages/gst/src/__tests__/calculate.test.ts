import { describe, it, expect } from "vitest";
import { calculateGST } from "../calculate";
import { isValidHSNCode } from "../hsn-map";

describe("calculateGST", () => {
  describe("CGST + SGST (intra-state)", () => {
    it("calculates 5% GST on T-shirts (HSN 6109) intra-state", () => {
      const result = calculateGST({
        subtotalPaise: 100_000,
        hsnCode: "6109",
        sellerStateCode: "29",
        buyerStateCode: "29",
        isExport: false,
      });

      expect(result.gstType).toBe("CGST_SGST");
      expect(result.gstRatePercent).toBe(5);
      expect(result.cgstPaise).toBe(2500);
      expect(result.sgstPaise).toBe(2500);
      expect(result.igstPaise).toBe(0);
      expect(result.totalTaxPaise).toBe(5000);
      expect(result.totalWithTaxPaise).toBe(105_000);
    });

    it("calculates 18% GST on footwear (HSN 6403) intra-state", () => {
      const result = calculateGST({
        subtotalPaise: 200_000,
        hsnCode: "6403",
        sellerStateCode: "27",
        buyerStateCode: "27",
        isExport: false,
      });

      expect(result.gstType).toBe("CGST_SGST");
      expect(result.gstRatePercent).toBe(18);
      expect(result.cgstPaise).toBe(18000);
      expect(result.sgstPaise).toBe(18000);
      expect(result.totalTaxPaise).toBe(36000);
      expect(result.totalWithTaxPaise).toBe(236_000);
    });

    it("handles odd amounts with correct rounding (remainder goes to SGST)", () => {
      const result = calculateGST({
        subtotalPaise: 33_333,
        hsnCode: "6109",
        sellerStateCode: "29",
        buyerStateCode: "29",
        isExport: false,
      });

      expect(result.gstType).toBe("CGST_SGST");
      expect(Number.isInteger(result.cgstPaise)).toBe(true);
      expect(Number.isInteger(result.sgstPaise)).toBe(true);
      expect(result.cgstPaise + result.sgstPaise).toBe(result.totalTaxPaise);
      expect(result.totalWithTaxPaise).toBe(33_333 + result.totalTaxPaise);
    });

    it("handles 28% GST on cosmetics (HSN 3304)", () => {
      const result = calculateGST({
        subtotalPaise: 50_000,
        hsnCode: "3304",
        sellerStateCode: "07",
        buyerStateCode: "07",
        isExport: false,
      });

      expect(result.gstType).toBe("CGST_SGST");
      expect(result.gstRatePercent).toBe(28);
      expect(result.totalTaxPaise).toBe(14_000);
      expect(result.totalWithTaxPaise).toBe(64_000);
    });
  });

  describe("IGST (inter-state)", () => {
    it("calculates IGST for inter-state sale", () => {
      const result = calculateGST({
        subtotalPaise: 100_000,
        hsnCode: "6109",
        sellerStateCode: "29",
        buyerStateCode: "27",
        isExport: false,
      });

      expect(result.gstType).toBe("IGST");
      expect(result.gstRatePercent).toBe(5);
      expect(result.cgstPaise).toBe(0);
      expect(result.sgstPaise).toBe(0);
      expect(result.igstPaise).toBe(5000);
      expect(result.totalTaxPaise).toBe(5000);
      expect(result.totalWithTaxPaise).toBe(105_000);
    });

    it("calculates IGST when buyer state is null (non-export domestic)", () => {
      const result = calculateGST({
        subtotalPaise: 100_000,
        hsnCode: "6109",
        sellerStateCode: "29",
        buyerStateCode: null,
        isExport: false,
      });

      expect(result.gstType).toBe("IGST");
      expect(result.igstPaise).toBe(5000);
    });
  });

  describe("EXPORT_LUT", () => {
    it("returns zero tax for export with LUT", () => {
      const result = calculateGST({
        subtotalPaise: 100_000,
        hsnCode: "6109",
        sellerStateCode: "29",
        buyerStateCode: null,
        isExport: true,
      });

      expect(result.gstType).toBe("EXPORT_LUT");
      expect(result.gstRatePercent).toBe(0);
      expect(result.cgstPaise).toBe(0);
      expect(result.sgstPaise).toBe(0);
      expect(result.igstPaise).toBe(0);
      expect(result.totalTaxPaise).toBe(0);
      expect(result.totalWithTaxPaise).toBe(100_000);
    });

    it("returns zero tax for export even with high-GST product", () => {
      const result = calculateGST({
        subtotalPaise: 500_000,
        hsnCode: "3304",
        sellerStateCode: "29",
        buyerStateCode: "US",
        isExport: true,
      });

      expect(result.gstType).toBe("EXPORT_LUT");
      expect(result.totalTaxPaise).toBe(0);
    });
  });

  describe("EXEMPT", () => {
    it("returns zero tax for exempt goods (books HSN 4901)", () => {
      const result = calculateGST({
        subtotalPaise: 50_000,
        hsnCode: "4901",
        sellerStateCode: "29",
        buyerStateCode: "29",
        isExport: false,
      });

      expect(result.gstType).toBe("EXEMPT");
      expect(result.gstRatePercent).toBe(0);
      expect(result.totalTaxPaise).toBe(0);
      expect(result.totalWithTaxPaise).toBe(50_000);
    });
  });

  describe("edge cases", () => {
    it("throws for unknown HSN code", () => {
      expect(() =>
        calculateGST({
          subtotalPaise: 100_000,
          hsnCode: "9999",
          sellerStateCode: "29",
          buyerStateCode: "29",
          isExport: false,
        })
      ).toThrow("Unknown HSN code");
    });

    it("throws for negative subtotal", () => {
      expect(() =>
        calculateGST({
          subtotalPaise: -100,
          hsnCode: "6109",
          sellerStateCode: "29",
          buyerStateCode: "29",
          isExport: false,
        })
      ).toThrow("subtotalPaise must be a non-negative integer");
    });

    it("throws for non-integer subtotal", () => {
      expect(() =>
        calculateGST({
          subtotalPaise: 100.5,
          hsnCode: "6109",
          sellerStateCode: "29",
          buyerStateCode: "29",
          isExport: false,
        })
      ).toThrow("subtotalPaise must be a non-negative integer");
    });

    it("handles zero subtotal", () => {
      const result = calculateGST({
        subtotalPaise: 0,
        hsnCode: "6109",
        sellerStateCode: "29",
        buyerStateCode: "29",
        isExport: false,
      });

      expect(result.totalTaxPaise).toBe(0);
      expect(result.totalWithTaxPaise).toBe(0);
    });

    it("uses only integer arithmetic — no floating-point drift", () => {
      const result = calculateGST({
        subtotalPaise: 99_999,
        hsnCode: "6109",
        sellerStateCode: "29",
        buyerStateCode: "29",
        isExport: false,
      });

      expect(Number.isInteger(result.cgstPaise)).toBe(true);
      expect(Number.isInteger(result.sgstPaise)).toBe(true);
      expect(Number.isInteger(result.igstPaise)).toBe(true);
      expect(Number.isInteger(result.totalTaxPaise)).toBe(true);
      expect(Number.isInteger(result.totalWithTaxPaise)).toBe(true);
    });

    it("includes correct HSN description in result", () => {
      const result = calculateGST({
        subtotalPaise: 100_000,
        hsnCode: "6109",
        sellerStateCode: "29",
        buyerStateCode: "29",
        isExport: false,
      });

      expect(result.hsnCode).toBe("6109");
      expect(result.hsnDescription).toBe("T-shirts, singlets and other vests, knitted");
    });

    it("matches 4-digit prefix for longer HSN codes", () => {
      const result = calculateGST({
        subtotalPaise: 100_000,
        hsnCode: "61091000",
        sellerStateCode: "29",
        buyerStateCode: "27",
        isExport: false,
      });

      expect(result.gstRatePercent).toBe(5);
    });

    it("isValidHSNCode returns true for known 4-digit and longer codes", () => {
      expect(isValidHSNCode("6109")).toBe(true);
      expect(isValidHSNCode("61091000")).toBe(true);
    });

    it("isValidHSNCode returns false for unknown code", () => {
      expect(isValidHSNCode("9999")).toBe(false);
    });
  });
});
