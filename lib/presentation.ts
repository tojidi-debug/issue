import type { ReviewCandidate } from "./domain";

export type ReasonTone =
  | "accounting"
  | "bookkeeping"
  | "valuation"
  | "consulting"
  | "neutral";

export function getReasonTone(
  candidate: Pick<ReviewCandidate, "serviceClass" | "issue">,
): ReasonTone {
  const value = `${candidate.serviceClass} ${candidate.issue}`;

  if (/재무제표|회계자문|회계처리|수정분개|기장대행|작성지원/.test(value)) {
    return "accounting";
  }
  if (/기장|기업진단/.test(value)) return "bookkeeping";
  if (/가치평가|valuation|양수도/i.test(value)) return "valuation";
  if (/컨설팅|자문|용역/.test(value)) return "consulting";
  return "neutral";
}
