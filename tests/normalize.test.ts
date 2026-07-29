import { describe, expect, it } from "vitest";
import {
  normalizeBusinessNumber,
  normalizeCompanyName,
  parseDateValue,
} from "../lib/normalize";

describe("normalizeCompanyName", () => {
  it("treats Korean legal-form variants as the same company", () => {
    expect(normalizeCompanyName("(주) 부천공업")).toBe("부천공업");
    expect(normalizeCompanyName("부천공업㈜")).toBe("부천공업");
    expect(normalizeCompanyName("주식회사 부천공업")).toBe("부천공업");
  });

  it("does not remove meaningful internal words", () => {
    expect(normalizeCompanyName("법인기업진단연구소")).toBe("기업진단연구소");
    expect(normalizeCompanyName("세강기업")).toBe("세강기업");
  });
});

describe("normalizeBusinessNumber", () => {
  it("returns ten digits from a formatted business number", () => {
    expect(normalizeBusinessNumber("130-81-23676")).toBe("1308123676");
  });

  it("rejects resident numbers and malformed values", () => {
    expect(normalizeBusinessNumber("900101-1234567")).toBe("");
    expect(normalizeBusinessNumber("12345")).toBe("");
  });
});

describe("parseDateValue", () => {
  it("parses Korean ledger date variants", () => {
    expect(parseDateValue("2025.01.31")).toBe("2025-01-31");
    expect(parseDateValue("01-31", 2024)).toBe("2024-01-31");
  });

  it("returns an empty string for impossible dates", () => {
    expect(parseDateValue("2025-02-30")).toBe("");
  });
});
