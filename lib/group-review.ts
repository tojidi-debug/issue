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
        legalBasis: "", summaryText: "",
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
    const highlights = group.transactionDates
      .map((date, index) => ({ date, memo: group.memos[index] ?? group.memos[0] ?? "용역", amount: undefined }))
      .slice(0, 3)
      .map(({ date, memo }) => `${date} ${memo}`)
      .join(", ");
    group.summaryText =
      `${group.targetKind} 대상인 ${group.matchedCompany}에 대해 ` +
      `${months}개월간 월평균 ${formatCompactAmount(group.monthlyAverage)}, ` +
      `합계 ${formatCompactAmount(group.totalAmount)}의 ${group.serviceClasses.join("·")} 관련 수수료 거래가 확인되었습니다. ` +
      `${highlights ? `주요 내역은 ${highlights}입니다. ` : ""}` +
      "계약서·세금계산서·산출물을 확인하여 실제 업무 성격과 경영진 의사결정 또는 회계장부 작성 관여 여부를 확인할 필요가 있습니다.";
  }
  return [...groups.values()].sort((a, b) =>
    a.year - b.year || (a.risk === b.risk ? 0 : a.risk === "상" ? -1 : 1) ||
    normalizeCompanyName(a.matchedCompany).localeCompare(normalizeCompanyName(b.matchedCompany)) ||
    a.dateFrom.localeCompare(b.dateFrom));
}
