import type { ReviewCandidate, ServiceClass, TargetKind } from "./domain";
import { normalizeCompanyName } from "./normalize";

export interface ReviewGroup {
  id: string;
  year: number;
  risk: ReviewCandidate["risk"];
  targetKind: TargetKind;
  matchedCompany: string;
  serviceClass: ServiceClass;
  issue: string;
  note: string;
  matchBasis: string;
  targetSource: string;
  attestationEvidence: string;
  dateFrom: string;
  dateTo: string;
  transactionCount: number;
  amountMin: number;
  amountMax: number;
  totalAmount: number;
  vatTotal: number;
  grossTotal: number;
  memos: string[];
  accountants: string[];
  sourceLocations: string[];
  years: number[];
  serviceClasses: ServiceClass[];
  transactionDates: string[];
  monthlyAverage: number;
  legalBasis: string;
  summaryText: string;
  basisSummary: string;
  yearDetails: Array<{
    year: number;
    months: string[];
    totalAmount: number;
    transactionCount: number;
    unitAmounts: number[];
    memos: string[];
  }>;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function groupKey(row: ReviewCandidate): string {
  return normalizeCompanyName(row.matchedCompany);
}

function combinedTarget(left: TargetKind, right: TargetKind): TargetKind {
  return left === right ? left : "감사·기업진단";
}

function formatCompactAmount(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억원`;
  if (absolute >= 1_000_000) return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value / 1_000_000)}백만원`;
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function sheetFromLocation(value: string): string {
  const parts = value.split(/\s*\/\s*/);
  return (parts.at(-1) ?? value).replace(/!\d+$/, "").trim();
}

function diagnosticSource(value: string): string {
  const match = value.match(/([^;/]+\.xlsx?\s*\/\s*[^!;]+)!?\d*/i);
  return match?.[1]?.trim() ?? sheetFromLocation(value);
}

function formatMonths(months: string[]): string {
  const values = [...new Set(months.map(Number))].sort((left, right) => left - right);
  if (values.length === 0) return "";
  const consecutive = values.every(
    (value, index) => index === 0 || value === values[index - 1] + 1,
  );
  if (consecutive && values.length > 1) {
    return `${values[0]}~${values[values.length - 1]}월`;
  }
  return `${values.join("·")}월`;
}

export function formatAmountRange(min: number, max: number): string {
  const format = (value: number) => new Intl.NumberFormat("ko-KR").format(value);
  return min === max ? `${format(min)}원` : `${format(min)}~${format(max)}원`;
}

export function groupReviewCandidates(rows: ReviewCandidate[]): ReviewGroup[] {
  const groups = new Map<string, ReviewGroup>();
  for (const row of rows) {
    const key = groupKey(row);
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        id: key, year: row.year, risk: row.risk, targetKind: row.targetKind,
        matchedCompany: row.matchedCompany, serviceClass: row.serviceClass,
        issue: row.issue, note: row.note, matchBasis: row.matchBasis,
        targetSource: row.targetSource, attestationEvidence: row.attestationEvidence,
        dateFrom: row.date, dateTo: row.date, transactionCount: 1,
        amountMin: row.amount, amountMax: row.amount, totalAmount: row.amount,
        vatTotal: row.vat, grossTotal: row.total, memos: unique([row.memo]),
        accountants: unique([row.accountant]), sourceLocations: unique([row.sourceLocation]),
        years: [row.year], serviceClasses: [row.serviceClass],
        transactionDates: [row.date], monthlyAverage: row.amount,
        legalBasis: "", summaryText: "", basisSummary: "",
        yearDetails: [{
          year: row.year, months: [row.date.slice(5, 7)], totalAmount: row.amount,
          transactionCount: 1, unitAmounts: [row.amount], memos: unique([row.memo]),
        }],
      });
      continue;
    }
    current.dateFrom = current.dateFrom < row.date ? current.dateFrom : row.date;
    current.dateTo = current.dateTo > row.date ? current.dateTo : row.date;
    current.transactionCount += 1;
    current.risk = current.risk === "상" || row.risk === "상" ? "상" : "중";
    current.targetKind = combinedTarget(current.targetKind, row.targetKind);
    current.amountMin = Math.min(current.amountMin, row.amount);
    current.amountMax = Math.max(current.amountMax, row.amount);
    current.totalAmount += row.amount;
    current.vatTotal += row.vat;
    current.grossTotal += row.total;
    current.memos = unique([...current.memos, row.memo]);
    current.accountants = unique([...current.accountants, row.accountant]);
    current.sourceLocations = unique([...current.sourceLocations, row.sourceLocation]);
    current.years = unique([...current.years.map(String), String(row.year)]).map(Number);
    current.serviceClasses = unique([
      ...current.serviceClasses,
      row.serviceClass,
    ]) as ServiceClass[];
    current.transactionDates = unique([...current.transactionDates, row.date]);
    const yearDetail = current.yearDetails.find((detail) => detail.year === row.year);
    if (yearDetail) {
      yearDetail.months = unique([...yearDetail.months, row.date.slice(5, 7)]).sort();
      yearDetail.totalAmount += row.amount;
      yearDetail.transactionCount += 1;
      yearDetail.unitAmounts = unique([
        ...yearDetail.unitAmounts.map(String),
        String(row.amount),
      ]).map(Number);
      yearDetail.memos = unique([...yearDetail.memos, row.memo]);
    } else {
      current.yearDetails.push({
        year: row.year, months: [row.date.slice(5, 7)], totalAmount: row.amount,
        transactionCount: 1, unitAmounts: [row.amount], memos: [row.memo],
      });
    }
    current.issue = unique([current.issue, row.issue]).join(" / ");
    current.note = unique([current.note, row.note]).join(" ");
    current.attestationEvidence = unique([
      current.attestationEvidence, row.attestationEvidence,
    ]).join("; ");
  }
  for (const group of groups.values()) {
    const months = unique(group.transactionDates.map((date) => date.slice(0, 7))).length || 1;
    group.monthlyAverage = group.totalAmount / months;
    group.legalBasis =
      group.targetKind === "외부감사"
        ? "외부감사법상 독립성 검토 후보"
        : group.targetKind === "기업진단"
          ? "공인회계사법상 독립성 검토 후보"
          : "외부감사법·공인회계사법상 독립성 검토 후보";
    const yearlyText = group.yearDetails
      .sort((left, right) => left.year - right.year)
      .map((detail) => {
        const monthsText = formatMonths(detail.months);
        const memoText = group.serviceClasses.includes("기장·전표처리")
          ? "기장료"
          : detail.memos.slice(0, 3).join("·");
        const unitText = formatAmountRange(
          Math.min(...detail.unitAmounts),
          Math.max(...detail.unitAmounts),
        );
        return `${String(detail.year).slice(2)}년 ${monthsText} ${memoText} 총 ${new Intl.NumberFormat("ko-KR").format(detail.totalAmount)}원(건당 ${unitText})`;
      })
      .join(", ");
    group.summaryText =
      `${group.targetKind} 대상인 ${group.matchedCompany}: ${yearlyText} 확인 필요.`;
    const ledgerSheets = unique(group.sourceLocations.map(sheetFromLocation)).slice(0, 3);
    const feeDescription = group.serviceClasses.includes("기장·전표처리")
      ? "기장료 납부내역"
      : "자문·컨설팅·기타용역 수수료 납부내역";
    const auditSource = sheetFromLocation(group.targetSource);
    const diagnosisSource = diagnosticSource(group.attestationEvidence);
    group.basisSummary =
      group.targetKind === "기업진단"
        ? `${diagnosisSource}상 기업진단 회사이자, ${ledgerSheets.join(", ")} ${feeDescription} 확인 필요`
        : group.targetKind === "외부감사"
          ? `${auditSource}상 외부감사 회사이자, ${ledgerSheets.join(", ")} ${feeDescription} 확인 필요`
          : `${auditSource}상 외부감사·기업진단 회사이자, ${ledgerSheets.join(", ")} ${feeDescription} 확인 필요`;
  }
  return [...groups.values()].sort((a, b) =>
    a.year - b.year || (a.risk === b.risk ? 0 : a.risk === "상" ? -1 : 1) ||
    normalizeCompanyName(a.matchedCompany).localeCompare(normalizeCompanyName(b.matchedCompany)) ||
    a.dateFrom.localeCompare(b.dateFrom));
}
