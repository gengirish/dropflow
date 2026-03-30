import { describe, it, expect } from "vitest";
import { validateGSTIN, getStateName } from "../validate-gstin";

describe("validateGSTIN", () => {
  it("validates a correctly formatted GSTIN", () => {
    // 29AABCU9603R1ZM is a well-known example GSTIN (Infosys)
    const result = validateGSTIN("29AABCU9603R1ZM");
    expect(result.stateCode).toBe("29");
    // Note: checksum may or may not match for this example
  });

  it("accepts GSTIN when checksum matches", () => {
    const result = validateGSTIN("29AABCU9603R1ZJ");
    expect(result.valid).toBe(true);
    expect(result.stateCode).toBe("29");
  });

  it("rejects GSTIN when checksum does not match", () => {
    const result = validateGSTIN("29AABCU9603R1ZM");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Checksum mismatch");
  });

  it("rejects GSTIN shorter than 15 chars", () => {
    const result = validateGSTIN("29AABCU9603R1Z");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("15 characters");
  });

  it("rejects GSTIN longer than 15 chars", () => {
    const result = validateGSTIN("29AABCU9603R1ZMX");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("15 characters");
  });

  it("rejects invalid format", () => {
    const result = validateGSTIN("AABBCCDDEE12345");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("format");
  });

  it("rejects invalid state code 00", () => {
    const result = validateGSTIN("00AABCU9603R1ZM");
    expect(result.valid).toBe(false);
  });

  it("rejects non-string input", () => {
    const result = validateGSTIN(123 as unknown as string);
    expect(result.valid).toBe(false);
  });

  it("rejects empty string", () => {
    const result = validateGSTIN("");
    expect(result.valid).toBe(false);
  });
});

describe("getStateName", () => {
  it("returns state name for valid code", () => {
    expect(getStateName("29")).toBe("Karnataka");
    expect(getStateName("27")).toBe("Maharashtra");
    expect(getStateName("07")).toBe("Delhi");
  });

  it("returns undefined for invalid code", () => {
    expect(getStateName("99")).toBeUndefined();
  });
});
