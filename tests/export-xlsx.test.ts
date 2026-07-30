import * as XLSX from "xlsx";
import { expect, it } from "vitest";
import type { ReviewCandidate } from "../lib/domain";
import { buildReviewWorkbook } from "../lib/export-xlsx";

function candidate(year: number, note: string): ReviewCandidate {
  return {
    id: `${year}`,
    year,
    date: `${year}-01-31`,
    voucherNo: "50001",
    clientName: "부천공업",
    businessNumber: "1308123676",
    memo: "컨설팅 수수료",
    account: "기타수입",
    section: "매출",
    amount: 100000,
    vat: 10000,
    total: 110000,
    accountant: "임중길",
    sourceFile: "sample.xlsx",
    sourceSheet: "임중길",
    sourceLocation: "sample.xlsx / 임중길!2",
    risk: "상",
    serviceClass: "회계자문·컨설팅",
    targetKind: "외부감사",
    matchedCompany: "부천공업",
    matchBasis: "사업자번호 일치",
    issue: "업무 확인",
    note,
    targetSource: "사전감리자료",
    attestationEvidence: "감사대상",
  };
}

it("creates 24년 and 25년 sheets with the review note column", () => {
  const bytes = buildReviewWorkbook([
    candidate(2024, "기장업무 여부 확인"),
    candidate(2025, "수정분개 제시 여부 확인"),
  ]);
  const workbook = XLSX.read(bytes, { type: "array" });
  expect(workbook.SheetNames).toEqual(["24년", "25년"]);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["24년"], {
    header: 1,
  });
  expect(rows[0]).toContain("비고(왜 확인해야 하는지)");
  expect(rows[1]).toContain("기장업무 여부 확인");
});

