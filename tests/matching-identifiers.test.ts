import { describe, expect, it } from "vitest";
import type { AttestationClient, Transaction } from "../lib/domain";
import { matchAttestationClient } from "../lib/matching";
import { normalizeBusinessNumber, normalizeCompanyName } from "../lib/normalize";

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    year: 2025,
    date: "2025-01-31",
    voucherNo: "50001",
    clientName: "부천공업",
    businessNumber: "",
    corporateNumber: "",
    memo: "컨설팅 수수료",
    account: "기타수입",
    section: "매출",
    amount: 100000,
    vat: 10000,
    total: 110000,
    accountant: "담당자",
    sourceFile: "sales.xlsx",
    sourceSheet: "Sheet1",
    sourceLocation: "sales.xlsx / Sheet1!2",
    ...overrides,
  };
}

function client(overrides: Partial<AttestationClient> = {}): AttestationClient {
  const canonicalName = overrides.canonicalName ?? "부천공업";
  return {
    id: "client-1",
    canonicalName,
    normalizedName: normalizeCompanyName(canonicalName),
    businessNumber: normalizeBusinessNumber(overrides.businessNumber ?? ""),
    corporateNumber: overrides.corporateNumber ?? "",
    kind: "외부감사",
    source: "reference.xlsx / Sheet1!2",
    ...overrides,
    normalizedName: normalizeCompanyName(canonicalName),
  };
}

describe("matchAttestationClient identifier priority", () => {
  it("prioritizes an exact business number", () => {
    expect(
      matchAttestationClient(
        tx({ clientName: "다른 표기", businessNumber: "130-81-23676" }),
        [client({ businessNumber: "130-81-23676" })],
      )?.basis,
    ).toBe("사업자번호 일치");
  });

  it("uses a corporate registration number before a normalized company name", () => {
    expect(
      matchAttestationClient(
        tx({ clientName: "다른 표기", corporateNumber: "110111-1234567" }),
        [client({ canonicalName: "농업회사법인 실제회사", corporateNumber: "1101111234567" })],
      )?.basis,
    ).toBe("법인등록번호 일치");
  });

  it("matches legal-form variants by the remaining company name", () => {
    expect(
      matchAttestationClient(
        tx({ clientName: "농업회사법인 늘푸른" }),
        [client({ canonicalName: "(유) 늘푸른" })],
      )?.basis,
    ).toBe("정규화 회사명 일치");
  });

  it("does not match the same name when a populated identifier conflicts", () => {
    expect(
      matchAttestationClient(
        tx({ clientName: "늘푸른", corporateNumber: "110111-1234567" }),
        [client({ canonicalName: "주식회사 늘푸른", corporateNumber: "110111-7654321" })],
      ),
    ).toBeNull();
  });
});
