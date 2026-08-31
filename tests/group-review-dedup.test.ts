import { expect, it } from "vitest";
import type { ReviewCandidate } from "../lib/domain";
import { groupReviewCandidates } from "../lib/group-review";

function candidate(id: string, issue: string): ReviewCandidate {
  return {
    id,
    year: 2025,
    date: `2025-0${Number(id) + 1}-10`,
    voucherNo: id,
    clientName: "주식회사 예시",
    businessNumber: "",
    memo: "기장료",
    account: "",
    section: "매출",
    amount: 130000,
    vat: 13000,
    total: 143000,
    accountant: "김회계",
    sourceFile: "매출장.xlsx",
    sourceSheet: "25년",
    sourceLocation: `매출장.xlsx / 25년!${id}`,
    risk: "상",
    serviceClass: "기장·전표처리",
    targetKind: "기업진단",
    matchedCompany: "주식회사 예시",
    matchBasis: "기업진단 거래 회사명 일치",
    issue,
    note: "증빙 확인 필요",
    targetSource: "매출장 내 기업진단 거래",
    attestationEvidence: "2025-01-10 / 기업진단수수료",
  };
}

it("keeps each review issue once when issues alternate across transactions", () => {
  const bookkeeping = "기업진단과 기장업무 동시수행 여부 확인";
  const statementHelp = "재무제표 대리작성·작성지원 또는 수정분개 제시 여부 확인";
  const [group] = groupReviewCandidates([
    candidate("1", bookkeeping),
    candidate("2", statementHelp),
    candidate("3", bookkeeping),
    candidate("4", bookkeeping),
  ]);

  expect(group.issue).toBe(`${bookkeeping} / ${statementHelp}`);
});
