import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { inferYearFromRows } from "../lib/adaptive-sales";
import { parseSalesRows, parseSpreadsheet } from "../lib/parse-spreadsheet";

const multiRowLedger = [
  ["", "", "", "매 출 장"],
  ["", "", "", "2024.01.01 ~ 2024.12.31"],
  [],
  ["", "일 자", "", "품 목", "", "", "", "", "매 출", "", "", "", "합계"],
  ["", "", "", "", "", "", "", "", "공 급 가 액", "", "부가가치세"],
  ["", "2024/01/03", "", "기장수수료(12월분)", "", "", "목포자동차종합병원", "", 90000, "", 9000, "", 99000],
  ["", "2024/01/09", "", "기장수수료(1월분)", "", "", "용두농업협동조합", "", 225000, "", 22500, "", 247500],
  ["", "일 계 [2건]", "", "", "", "", "", "", 315000, "", 31500, "", 346500],
  ["", "일 자", "", "품 목", "", "", "", "", "매 출", "", "", "", "합계"],
  ["", "", "", "", "", "", "", "", "공 급 가 액", "", "부가가치세"],
  ["", "2024/01/10", "", "기장수수료(12월분)", "", "", "(유)새한테크", "", 300000, "", 30000, "", 330000],
];

describe("adaptive sales-ledger parsing", () => {
  it("infers an older fiscal-year heading and parses month-day ledger rows", () => {
    const rows = [
      ["", "", "계 정 별 원 장"],
      ["", "", "2021.04.01 ~ 2022.03.31"],
      ["날짜", "적요란", "거래처", "차변", "대변", "잔액"],
      ["04-06", "제1,2기 감사수수료", "한빛 주식회사", "", 2500000, 48500000],
    ];

    expect(inferYearFromRows(rows)).toBe(2021);
    expect(
      parseSalesRows(rows, {
        accountant: "한일",
        year: 2021,
        sourceFile: "매출계정별원장(한일제출).xls",
        sheetName: "감사수수료",
      }),
    ).toEqual([
      expect.objectContaining({
        date: "2021-04-06",
        clientName: "한빛 주식회사",
        memo: "제1,2기 감사수수료",
        amount: 2500000,
      }),
    ]);
  });

  it("infers separate memo and company columns beneath repeated multi-row headers", () => {
    const result = parseSalesRows(multiRowLedger, {
      accountant: "김진태",
      year: 2024,
      sourceFile: "매출장(2024년, 김진태).xlsx",
      sheetName: "다산",
    });

    expect(result).toMatchObject([
      {
        date: "2024-01-03",
        memo: "기장수수료(12월분)",
        clientName: "목포자동차종합병원",
        amount: 90000,
        vat: 9000,
        total: 99000,
      },
      {
        date: "2024-01-09",
        clientName: "용두농업협동조합",
        amount: 225000,
      },
      {
        date: "2024-01-10",
        clientName: "(유)새한테크",
        sourceLocation: "매출장(2024년, 김진태).xlsx / 다산!11",
      },
    ]);
  });

  it("splits a single description column into service details and company", () => {
    const rows = [
      ["번호", "일자", "적요", "공급가액", "부가가치세", "구분"],
      [50001, "2025/01/03", "2025년장부대 주식회사베델코리아", 100000, 10000, "25_양미연"],
      [50002, "2025/01/25", "1월기장료 인화성공", 80000, 8000, "25_양미연"],
      [50003, "2025/02/25", "부가세신고수수료 현대기업사", 150000, 15000, "25_양미연"],
    ];

    expect(
      parseSalesRows(rows, {
        accountant: "양미연",
        year: 2025,
        sourceFile: "통합 매출장.xlsx",
        sheetName: "25년",
      }),
    ).toMatchObject([
      { memo: "2025년장부대", clientName: "주식회사베델코리아" },
      { memo: "1월기장료", clientName: "인화성공" },
      { memo: "부가세신고수수료", clientName: "현대기업사" },
    ]);
  });

  it("uses each sheet layout and dates when one workbook contains multiple years", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(multiRowLedger),
      "24년",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["번호", "일자", "적요", "공급가액", "부가가치세", "구분"],
        [50001, "2025/01/03", "2025년장부대 주식회사베델코리아", 100000, 10000, "25_양미연"],
      ]),
      "25년",
    );
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const file = new File([bytes], "구성원 전체 매출장.xlsx");

    const result = await parseSpreadsheet(file, "sales");

    expect(result.warnings).toEqual([]);
    expect(result.transactions).toMatchObject([
      { year: 2024, sourceSheet: "24년", clientName: "목포자동차종합병원" },
      { year: 2024, sourceSheet: "24년", clientName: "용두농업협동조합" },
      { year: 2024, sourceSheet: "24년", clientName: "(유)새한테크" },
      { year: 2025, sourceSheet: "25년", clientName: "주식회사베델코리아" },
    ]);
  });
});
