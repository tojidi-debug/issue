import * as XLSX from "xlsx-js-style";
import type { ReviewCandidate } from "./domain";

const COLUMNS = [
  "연도", "위험도", "인증대상 구분", "매칭 회사", "거래일자", "전표번호", "거래처",
  "사업자(주민)번호", "담당회계사", "품명·적요", "계정과목", "공급가액", "부가세",
  "합계", "용역분류", "확인필요사항", "매칭근거", "인증근거", "원본위치",
  "비고(왜 확인해야 하는지)",
] as const;

function toExportRow(candidate: ReviewCandidate): Record<string, string | number> {
  return {
    연도: candidate.year,
    위험도: candidate.risk,
    "인증대상 구분": candidate.targetKind,
    "매칭 회사": candidate.matchedCompany,
    거래일자: candidate.date,
    전표번호: candidate.voucherNo,
    거래처: candidate.clientName,
    "사업자(주민)번호": candidate.businessNumber,
    담당회계사: candidate.accountant,
    "품명·적요": candidate.memo,
    계정과목: candidate.account,
    공급가액: candidate.amount,
    부가세: candidate.vat,
    합계: candidate.total,
    용역분류: candidate.serviceClass,
    확인필요사항: candidate.issue,
    매칭근거: candidate.matchBasis,
    인증근거: candidate.attestationEvidence || candidate.targetSource,
    원본위치: candidate.sourceLocation,
    "비고(왜 확인해야 하는지)": candidate.note,
  };
}

function applyDefaultFont(sheet: XLSX.WorkSheet): void {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:T1");
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell) cell.s = { ...(cell.s ?? {}), font: { name: "함초롬돋움", sz: 10 } };
    }
  }
}

export function buildReviewWorkbook(candidates: ReviewCandidate[]): Uint8Array {
  const workbook = XLSX.utils.book_new();
  for (const year of [2024, 2025]) {
    const rows = candidates.filter((candidate) => candidate.year === year).map(toExportRow);
    const sheet = XLSX.utils.json_to_sheet(rows, { header: [...COLUMNS] });
    sheet["!autofilter"] = { ref: sheet["!ref"] ?? "A1:T1" };
    sheet["!freeze"] = { xSplit: 4, ySplit: 1 };
    sheet["!cols"] = [
      8, 8, 14, 20, 12, 12, 22, 16, 12, 28,
      16, 14, 12, 14, 24, 32, 24, 30, 30, 64,
    ].map((wch) => ({ wch }));
    applyDefaultFont(sheet);
    XLSX.utils.book_append_sheet(workbook, sheet, `${String(year).slice(2)}년`);
  }
  return XLSX.write(workbook, { type: "array", bookType: "xlsx", cellStyles: true });
}

export function downloadReviewWorkbook(candidates: ReviewCandidate[]): void {
  const bytes = buildReviewWorkbook(candidates);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "매출 확인.xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
