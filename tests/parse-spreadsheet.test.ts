import { describe, expect, it } from "vitest";
import { parseAttestationRows, parseSalesRows } from "../lib/parse-spreadsheet";

describe("parseSalesRows", () => {
  it("parses standard sales ledger headers and keeps the source row", () => {
    const rows = [
      ["구분", "전표일자", "번호", "거래처", "사업자(주민)번호", "품명", "공급가액", "부가세"],
      ["매출", "2025-01-31", "50001", "(유)전남건설", "410-81-00000", "기장수수료", 150000, 15000],
    ];
    expect(
      parseSalesRows(rows, {
        accountant: "김진태",
        year: 2025,
        sourceFile: "sample.xlsx",
        sheetName: "김진태",
      }),
    ).toMatchObject([
      {
        clientName: "(유)전남건설",
        amount: 150000,
        total: 165000,
        sourceLocation: "sample.xlsx / 김진태!2",
      },
    ]);
  });

  it("parses account-ledger headers", () => {
    const rows = [
      ["날짜", "적요란", "거래처", "대변"],
      ["01-31", "법인결산", "전남건설(유)", 220000],
    ];
    expect(
      parseSalesRows(rows, {
        accountant: "박숙희",
        year: 2025,
        sourceFile: "ledger.xlsx",
        sheetName: "기타수입",
      }),
    ).toMatchObject([{ date: "2025-01-31", memo: "법인결산", amount: 220000 }]);
  });
});

describe("parseAttestationRows", () => {
  it("extracts audit clients and both identifiers from a variable header row", () => {
    const rows = [
      ["외부감사 수행회사 현황"],
      ["NO", "사업연도", "법인등록번호", "사업자등록번호", "회사명"],
      [1, "당기", "110111-1234567", "130-81-23676", "부천공업㈜"],
    ];
    expect(parseAttestationRows(rows, "2-1. 외부감사 수행회사 현황", "pre.xlsx")).toMatchObject([
      {
        canonicalName: "부천공업㈜",
        businessNumber: "1308123676",
        corporateNumber: "1101111234567",
        kind: "외부감사",
      },
    ]);
  });

  it("does not hard-code a particular audit group", () => {
    const rows = [
      ["감사인명", "회사명", "사업자등록번호"],
      ["서석감사반", "세강산업", "111-22-33333"],
      ["다른감사반", "제외회사", "444-55-66666"],
    ];
    expect(parseAttestationRows(rows, "2026년 수임신고 외감", "engagement.xlsx")).toHaveLength(2);
  });
});
