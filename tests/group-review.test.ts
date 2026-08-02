import { describe, expect, it } from "vitest";
import type { ReviewCandidate } from "../lib/domain";
import { formatAmountRange, groupReviewCandidates } from "../lib/group-review";

function candidate(overrides: Partial<ReviewCandidate> = {}): ReviewCandidate {
  return {
    id: "gaon-04", year: 2025, date: "2025-04-10", voucherNo: "50001",
    clientName: "주식회사가온전력", businessNumber: "", memo: "4월기장료",
    account: "", section: "매출", amount: 130000, vat: 13000, total: 143000,
    accountant: "김회계", sourceFile: "가온감사반_매출장.xlsx", sourceSheet: "25년",
    sourceLocation: "가온감사반_매출장.xlsx / 25년!2585", risk: "상",
    serviceClass: "기장·전표처리", targetKind: "기업진단",
    matchedCompany: "주식회사가온전력", matchBasis: "기업진단 거래 회사명 일치",
    issue: "기업진단과 기장업무 동시수행 여부 확인",
    note: "기업진단 회사에 대한 기장업무 병행 가능성을 확인해야 합니다.",
    targetSource: "매출장 내 기업진단 거래",
    attestationEvidence: "2025-03-31 / 기업진단수수료 / 500,000원 / 가온감사반_매출장.xlsx / 25년!2490",
    ...overrides,
  };
}

describe("groupReviewCandidates", () => {
  it("groups recurring monthly transactions and preserves the attestation basis", () => {
    const groups = groupReviewCandidates([
      candidate(),
      candidate({ id: "gaon-05", date: "2025-05-10", memo: "5월기장료", amount: 150000,
        total: 165000, sourceLocation: "가온감사반_매출장.xlsx / 25년!2683" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ transactionCount: 2, dateFrom: "2025-04-10",
      dateTo: "2025-05-10", amountMin: 130000, amountMax: 150000, totalAmount: 280000 });
    expect(groups[0].attestationEvidence).toContain("25년!2490");
    expect(groups[0].sourceLocations).toEqual([
      "가온감사반_매출장.xlsx / 25년!2585", "가온감사반_매출장.xlsx / 25년!2683",
    ]);
  });

  it("formats a single amount or an amount range", () => {
    expect(formatAmountRange(130000, 130000)).toBe("130,000원");
    expect(formatAmountRange(130000, 150000)).toBe("130,000~150,000원");
  });
});
