import * as XLSX from "xlsx";
import { strFromU8, unzipSync } from "fflate";
import { expect, it } from "vitest";
import type { ReviewCandidate } from "../lib/domain";
import { buildReviewWorkbook } from "../lib/export-xlsx";

const candidate: ReviewCandidate = {
  id: "2024", year: 2024, date: "2024-01-31", voucherNo: "50001",
  clientName: "부천공업", businessNumber: "1308123676", memo: "컨설팅 수수료",
  account: "기타수입", section: "매출", amount: 100000, vat: 10000, total: 110000,
  accountant: "임중길", sourceFile: "sample.xlsx", sourceSheet: "임중길",
  sourceLocation: "sample.xlsx / 임중길!2", risk: "상",
  serviceClass: "회계자문·컨설팅", targetKind: "외부감사", matchedCompany: "부천공업",
  matchBasis: "사업자번호 일치", issue: "업무 확인", note: "기장업무 여부 확인",
  targetSource: "사전감리자료", attestationEvidence: "감사대상",
};

it("writes the requested font to the XLSX style table", () => {
  const bytes = new Uint8Array(buildReviewWorkbook([candidate]));
  const workbook = XLSX.read(bytes, { type: "array" });
  expect(workbook.SheetNames).toEqual(["24년", "25년"]);
  const archive = unzipSync(bytes);
  const styles = strFromU8(archive["xl/styles.xml"]);
  expect(styles).toContain('<sz val="10"/>');
  expect(styles).toContain('<name val="함초롬돋움"/>');
});
