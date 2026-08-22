import * as XLSX from "xlsx-js-style";
import type { ReviewCandidate } from "./domain";
import { groupReviewCandidates } from "./group-review";

const DETAIL_COLUMNS = [
  "연도", "위험도", "인증대상 구분", "매칭 회사", "거래일자", "전표번호", "거래처",
  "사업자(주민)번호", "담당회계사", "품명·적요", "계정과목", "공급가액", "부가세",
  "합계", "용역분류", "확인필요사항", "매칭근거", "인증근거", "원본위치",
  "비고(왜 확인해야 하는지)",
] as const;

const SUMMARY_COLUMNS = [
  "회사", "연도", "위험도", "인증대상", "검토대상 기간", "검토 전표 요약",
  "대상 판단 근거", "매칭근거", "확인필요사항", "공급가액 합계", "부가세 합계",
  "합계", "담당회계사", "원본위치", "비고(왜 확인해야 하는지)",
] as const;

function toDetailRow(candidate: ReviewCandidate): Record<string, string | number> {
  return {
    연도: candidate.year, 위험도: candidate.risk, "인증대상 구분": candidate.targetKind,
    "매칭 회사": candidate.matchedCompany, 거래일자: candidate.date,
    전표번호: candidate.voucherNo, 거래처: candidate.clientName,
    "사업자(주민)번호": candidate.businessNumber, 담당회계사: candidate.accountant,
    "품명·적요": candidate.memo, 계정과목: candidate.account, 공급가액: candidate.amount,
    부가세: candidate.vat, 합계: candidate.total, 용역분류: candidate.serviceClass,
    확인필요사항: candidate.issue, 매칭근거: candidate.matchBasis,
    인증근거: candidate.attestationEvidence || candidate.targetSource,
    원본위치: candidate.sourceLocation, "비고(왜 확인해야 하는지)": candidate.note,
  };
}

function toSummaryRows(candidates: ReviewCandidate[]): Record<string, string | number>[] {
  return groupReviewCandidates(candidates).map((group) => ({
    회사: group.matchedCompany, 연도: group.years.join(", "), 위험도: group.risk,
    인증대상: group.targetKind,
    "검토대상 기간": group.dateFrom === group.dateTo ? group.dateFrom : `${group.dateFrom}~${group.dateTo}`,
    "검토 전표 요약": group.summaryText,
    "대상 판단 근거": group.attestationEvidence || group.targetSource,
    매칭근거: group.matchBasis, 확인필요사항: group.issue,
    "공급가액 합계": group.totalAmount, "부가세 합계": group.vatTotal, 합계: group.grossTotal,
    담당회계사: group.accountants.join(", "), 원본위치: group.sourceLocations.join("; "),
    "비고(왜 확인해야 하는지)": group.note,
  }));
}

function applyBaseStyle(sheet: XLSX.WorkSheet, columnCount: number): void {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (!cell) continue;
      cell.s = {
        ...(cell.s ?? {}),
        font: { name: "함초롬돋움", sz: 10, bold: row === 0, color: row === 0 ? { rgb: "FFFFFF" } : { rgb: "172033" } },
        fill: { patternType: "solid", fgColor: { rgb: row === 0 ? "173A63" : row % 2 ? "F1F7FC" : "F7F8FA" } },
        alignment: { vertical: "center", wrapText: true },
        border: { bottom: { style: "thin", color: { rgb: "DDE5EC" } } },
      };
    }
  }
  sheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(columnCount - 1)}${range.e.r + 1}` };
  sheet["!freeze"] = { xSplit: 1, ySplit: 1 };
  sheet["!rows"] = [{ hpt: 26 }, ...Array.from({ length: range.e.r }, () => ({ hpt: 42 }))];
}

export function buildReviewWorkbook(candidates: ReviewCandidate[]): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.json_to_sheet(toSummaryRows(candidates), { header: [...SUMMARY_COLUMNS] });
  summary["!cols"] = [22, 8, 8, 13, 23, 48, 58, 25, 34, 16, 14, 16, 18, 62, 68].map((wch) => ({ wch }));
  applyBaseStyle(summary, SUMMARY_COLUMNS.length);
  XLSX.utils.book_append_sheet(workbook, summary, "요약");

  const years = [...new Set(candidates.map((candidate) => candidate.year))].sort();
  for (const year of years) {
    const rows = candidates.filter((candidate) => candidate.year === year).map(toDetailRow);
    const sheet = XLSX.utils.json_to_sheet(rows, { header: [...DETAIL_COLUMNS] });
    sheet["!cols"] = [8, 8, 14, 20, 12, 12, 22, 16, 12, 28, 16, 14, 12, 14, 24, 32, 24, 44, 38, 64].map((wch) => ({ wch }));
    applyBaseStyle(sheet, DETAIL_COLUMNS.length);
    sheet["!freeze"] = { xSplit: 4, ySplit: 1 };
    XLSX.utils.book_append_sheet(workbook, sheet, `${String(year).slice(2)}년`);
  }
  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx", cellStyles: true }));
}

export function downloadReviewWorkbook(candidates: ReviewCandidate[]): void {
  const bytes = buildReviewWorkbook(candidates);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "매출 확인.xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
