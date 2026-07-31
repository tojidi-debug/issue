import { describe, expect, it } from "vitest";
import { parseAttestationRows, parseSalesRows } from "../lib/parse-spreadsheet";

describe("variable spreadsheet layouts", () => {
  it("finds a sales header after title and blank rows", () => {
    const rows = [
      ["2025년 매출장"],
      [],
      ["구분", "전표일자", "번호", "거래처", "법인등록번호", "품명", "공급가액"],
      ["매출", "2025-01-31", "50001", "(유)전남건설", "110111-1234567", "기장수수료", 150000],
    ];
    expect(
      parseSalesRows(rows, {
        accountant: "담당자",
        year: 2025,
        sourceFile: "sample.xlsx",
        sheetName: "두번째시트",
      }),
    ).toMatchObject([
      {
        clientName: "(유)전남건설",
        corporateNumber: "1101111234567",
        sourceLocation: "sample.xlsx / 두번째시트!4",
      },
    ]);
  });

  it("finds a reference header after title rows and reads both identifiers", () => {
    const rows = [
      ["외부감사 수행회사 현황"],
      [],
      ["법인등록번호", "사업자등록번호", "회사명", "감사인명"],
      ["110111-1234567", "130-81-23676", "농업회사법인 늘푸른", "임의감사반"],
    ];
    expect(parseAttestationRows(rows, "임의 시트", "reference.xlsx")).toMatchObject([
      {
        canonicalName: "농업회사법인 늘푸른",
        businessNumber: "1308123676",
        corporateNumber: "1101111234567",
      },
    ]);
  });
});
