import type { AttestationClient, Transaction } from "./domain";
import {
  normalizeBusinessNumber,
  normalizeCompanyName,
  normalizeCorporateNumber,
} from "./normalize";

export interface ClientMatch {
  client: AttestationClient;
  basis: string;
  confidence: "high" | "medium" | "review";
}

function identifiersConflict(transaction: Transaction, client: AttestationClient): boolean {
  const transactionBusiness = normalizeBusinessNumber(transaction.businessNumber);
  const clientBusiness = normalizeBusinessNumber(client.businessNumber);
  if (transactionBusiness && clientBusiness && transactionBusiness !== clientBusiness) return true;
  const transactionCorporate = normalizeCorporateNumber(transaction.corporateNumber);
  const clientCorporate = normalizeCorporateNumber(client.corporateNumber);
  return Boolean(
    transactionCorporate && clientCorporate && transactionCorporate !== clientCorporate,
  );
}

export function matchAttestationClient(
  transaction: Transaction,
  clients: AttestationClient[],
): ClientMatch | null {
  const businessNumber = normalizeBusinessNumber(transaction.businessNumber);
  if (businessNumber) {
    const byNumber = clients.find(
      (client) => normalizeBusinessNumber(client.businessNumber) === businessNumber,
    );
    if (byNumber) return { client: byNumber, basis: "사업자번호 일치", confidence: "high" };
  }

  const corporateNumber = normalizeCorporateNumber(transaction.corporateNumber);
  if (corporateNumber) {
    const byNumber = clients.find(
      (client) => normalizeCorporateNumber(client.corporateNumber) === corporateNumber,
    );
    if (byNumber) {
      return { client: byNumber, basis: "법인등록번호 일치", confidence: "high" };
    }
  }

  const normalized = normalizeCompanyName(transaction.clientName);
  if (!normalized) return null;
  const exact = clients.find(
    (client) => client.normalizedName === normalized && !identifiersConflict(transaction, client),
  );
  if (exact) {
    const shortName = normalized.length < 3;
    return {
      client: exact,
      basis: shortName ? "짧은 회사명 일치" : "정규화 회사명 일치",
      confidence: shortName ? "review" : "medium",
    };
  }

  if (businessNumber || corporateNumber) return null;
  const included = clients
    .filter((client) => {
      const candidate = client.normalizedName;
      return (
        candidate.length >= 5 &&
        normalized.length >= 4 &&
        (candidate.includes(normalized) || normalized.includes(candidate))
      );
    })
    .sort((a, b) => b.normalizedName.length - a.normalizedName.length)[0];
  return included
    ? { client: included, basis: "정규화 회사명 포함 일치", confidence: "review" }
    : null;
}
