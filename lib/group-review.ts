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
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function groupKey(row: ReviewCandidate): string {
  return [row.year, normalizeCompanyName(row.matchedCompany), row.targetKind,
    row.serviceClass, row.risk, row.issue].join("|");
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
      });
      continue;
    }
    current.dateFrom = current.dateFrom < row.date ? current.dateFrom : row.date;
    current.dateTo = current.dateTo > row.date ? current.dateTo : row.date;
    current.transactionCount += 1;
    current.amountMin = Math.min(current.amountMin, row.amount);
    current.amountMax = Math.max(current.amountMax, row.amount);
    current.totalAmount += row.amount;
    current.vatTotal += row.vat;
    current.grossTotal += row.total;
    current.memos = unique([...current.memos, row.memo]);
    current.accountants = unique([...current.accountants, row.accountant]);
    current.sourceLocations = unique([...current.sourceLocations, row.sourceLocation]);
    current.attestationEvidence = unique([
      current.attestationEvidence, row.attestationEvidence,
    ]).join("; ");
  }
  return [...groups.values()].sort((a, b) =>
    a.year - b.year || (a.risk === b.risk ? 0 : a.risk === "상" ? -1 : 1) ||
    normalizeCompanyName(a.matchedCompany).localeCompare(normalizeCompanyName(b.matchedCompany)) ||
    a.dateFrom.localeCompare(b.dateFrom));
}
