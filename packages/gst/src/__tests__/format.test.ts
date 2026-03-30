import { describe, it, expect } from "vitest";
import { formatPaise, formatPaiseCompact } from "../format";

describe("formatPaise", () => {
  it("formats paise to INR with lakh separators", () => {
    const result = formatPaise(12345600);
    expect(result).toContain("1,23,456");
  });

  it("formats zero", () => {
    const result = formatPaise(0);
    expect(result).toContain("0.00");
  });

  it("formats small amounts", () => {
    const result = formatPaise(100);
    expect(result).toContain("1.00");
  });
});

describe("formatPaiseCompact", () => {
  it("formats large amounts compactly", () => {
    const result = formatPaiseCompact(1_000_000_00);
    expect(result).toBeTruthy();
  });
});
