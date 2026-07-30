import type { AttestationClient, Transaction } from "./domain";
import { normalizeBusinessNumber, normalizeCompanyName } from "./normalize";

export interface ClientMatch {
  client: AttestationClient;
  basis: string;
  confidence: "high" | "medium" | "review";
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

  const normalized = normalizeCompanyName(transaction.clientName);
  if (!normalized) return null;
  const exact = clients.find((client) => client.normalizedName === normalized);
  if (exact) {
    const targetNumber = normalizeBusinessNumber(exact.businessNumber);
    if (businessNumber && targetNumber && businessNumber !== targetNumber) return null;
    return {
      client: exact,
      basis: normalized.length < 4 ? "짧은 회사명 일치" : "정규화 회사명 일치",
      confidence: normalized.length < 4 ? "review" : "medium",
    };
  }

  if (businessNumber) return null;
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
