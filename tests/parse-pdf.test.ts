import { describe, expect, it } from "vitest";
import {
  groupPdfItemsIntoLines,
  parseAccountLedgerLine,
  parseSalesLedgerLine,
} from "../lib/parse-pdf";

describe("PDF ledger line parsers", () => {
  it("parses a sales-ledger text line", () => {
    expect(
      parseSalesLedgerLine("50001 2025/01/31 기장수수료 (유)전남건설 150,000 15,000"),
    ).toMatchObject({
      voucherNo: "50001",
      date: "2025-01-31",
      clientName: "(유)전남건설",
      memo: "기장수수료",
      amount: 150000,
      vat: 15000,
    });
  });

  it("parses an account-ledger line", () => {
    expect(
      parseAccountLedgerLine(
        "01-31 수수료 001059 (주)아이비주택개발 150,000 1,200,000",
        2025,
      ),
    ).toMatchObject({
      date: "2025-01-31",
      clientName: "(주)아이비주택개발",
      amount: 150000,
    });
  });
});

describe("groupPdfItemsIntoLines", () => {
  it("groups nearby y coordinates and sorts each line by x", () => {
    const lines = groupPdfItemsIntoLines([
      { text: "B", x: 20, y: 100 },
      { text: "A", x: 10, y: 101 },
      { text: "C", x: 10, y: 80 },
    ]);
    expect(lines.map((line) => line.text)).toEqual(["A B", "C"]);
  });
});
