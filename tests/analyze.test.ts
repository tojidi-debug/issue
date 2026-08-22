import { describe, expect, it } from "vitest";
import type { AttestationClient, Transaction } from "../lib/domain";
import { analyzeIndependence } from "../lib/analyze";
import { matchAttestationClient } from "../lib/matching";
import { normalizeBusinessNumber, normalizeCompanyName } from "../lib/normalize";

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    year: 2024,
    date: "2024-01-31",
    voucherNo: "50001",
    clientName: "부천공업",
    businessNumber: "",
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
    ...overrides,
  };
}

function auditClient(overrides: Partial<AttestationClient> = {}): AttestationClient {
  const canonicalName = overrides.canonicalName ?? "부천공업";
  const businessNumber = normalizeBusinessNumber(overrides.businessNumber ?? "");
  return {
    id: "client-1",
    canonicalName,
    normalizedName: normalizeCompanyName(canonicalName),
    businessNumber,
    kind: "외부감사",
    source: "사전감리자료 2-1",
    ...overrides,
    normalizedName: normalizeCompanyName(canonicalName),
    businessNumber,
  };
}

describe("matchAttestationClient", () => {
  it("does not match the same short name when business numbers conflict", () => {
    const transaction = tx({ clientName: "누리", businessNumber: "410-25-34239" });
    const client = auditClient({
      canonicalName: "주식회사 누리",
      businessNumber: "409-86-49539",
    });
    expect(matchAttestationClient(transaction, [client])).toBeNull();
  });

  it("prioritizes an exact business number", () => {
    const transaction = tx({
      clientName: "표기가 다른 회사",
      businessNumber: "130-81-23676",
    });
    const client = auditClient({ businessNumber: "130-81-23676" });
    expect(matchAttestationClient(transaction, [client])?.basis).toBe("사업자번호 일치");
  });
});

describe("analyzeIndependence", () => {
  it("flags bookkeeping by any member for a diagnostic client", () => {
    const transactions = [
      tx({
        id: "diagnosis",
        accountant: "이정현",
        clientName: "세강기업",
        businessNumber: "734-81-03021",
        memo: "기업진단수수료",
        date: "2024-02-16",
      }),
      tx({
        id: "bookkeeping",
        accountant: "임중길",
        clientName: "주식회사 세강기업",
        businessNumber: "734-81-03021",
        memo: "기장료",
        date: "2024-07-30",
      }),
    ];
    const result = analyzeIndependence(transactions, []);
    expect(result.candidates).toMatchObject([
      {
        accountant: "임중길",
        risk: "상",
        targetKind: "기업진단",
      },
    ]);
    expect(result.candidates[0].note).toContain("공인회계사법 제21조");
    expect(result.candidates[0].attestationEvidence).toContain("기업진단수수료");
    expect(result.candidates[0].attestationEvidence).toContain("sample.xlsx / 임중길!2");
  });

  it("excludes tax filing for an audit client", () => {
    const transaction = tx({ clientName: "부천공업", memo: "법인세 신고대리" });
    const result = analyzeIndependence([transaction], [auditClient()]);
    expect(result.candidates).toHaveLength(0);
  });

  it("flags ambiguous consulting for an audit client with evidence guidance", () => {
    const result = analyzeIndependence(
      [tx({ businessNumber: "130-81-23676", memo: "컨설팅 수수료" })],
      [auditClient({ businessNumber: "130-81-23676" })],
    );
    expect(result.candidates[0]).toMatchObject({
      serviceClass: "회계자문·컨설팅",
      risk: "상",
    });
    expect(result.candidates[0].note).toContain("계약서");
  });

  it("matches prohibited services only to the same audit year", () => {
    const transaction = tx({ year: 2022, date: "2022-05-31", memo: "기장료" });
    expect(
      analyzeIndependence([transaction], [auditClient({ year: 2022 })]).candidates,
    ).toHaveLength(1);
    expect(
      analyzeIndependence([transaction], [auditClient({ year: 2021 })]).candidates,
    ).toHaveLength(0);
  });

  it("allows a separate attestation service in the same year", () => {
    const transaction = tx({ year: 2022, date: "2022-03-31", memo: "기업진단수수료" });
    expect(
      analyzeIndependence([transaction], [auditClient({ year: 2022 })]).candidates,
    ).toHaveLength(0);
  });

  it("applies a three-year cooling period to internal-control system builds", () => {
    const transaction = tx({
      year: 2019,
      date: "2019-06-30",
      memo: "내부통제 및 회계시스템 구축 용역",
    });
    expect(
      analyzeIndependence([transaction], [auditClient({ year: 2022 })]).candidates,
    ).toHaveLength(1);
    expect(
      analyzeIndependence([transaction], [auditClient({ year: 2023 })]).candidates,
    ).toHaveLength(0);
  });
});
