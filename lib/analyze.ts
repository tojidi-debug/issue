import { classifyService } from "./classify";
import type {
  AnalysisResult,
  AttestationClient,
  ReviewCandidate,
  ServiceClass,
  TargetKind,
  Transaction,
} from "./domain";
import { matchAttestationClient } from "./matching";
import { normalizeBusinessNumber, normalizeCompanyName } from "./normalize";

interface DiagnosticEvidence {
  client: AttestationClient;
  evidence: string[];
}

function diagnosticKey(transaction: Transaction): string {
  return (
    normalizeBusinessNumber(transaction.businessNumber) ||
    normalizeCompanyName(transaction.clientName)
  );
}

function buildNote(
  serviceClass: ServiceClass,
  targetKind: TargetKind,
): { issue: string; note: string } {
  if (targetKind === "기업진단" && serviceClass === "기장·전표처리") {
    return {
      issue: "기업진단과 기장업무 동시수행 여부 확인",
      note:
        "기업진단 회사에 대한 기장업무 병행 가능성이 있어 공인회계사법 제21조상 독립성 위반 여부를 확인해야 합니다. 기업진단 계약서, 기장계약서, 세금계산서와 수행기간을 대조하세요.",
    };
  }
  const notes: Partial<Record<ServiceClass, { issue: string; note: string }>> = {
    "기장·전표처리": {
      issue: "감사대상회사 기장·전표처리 여부 확인",
      note:
        "외부감사대상회사에 대한 기장 또는 전표처리 업무인지 확인해야 합니다. 계약서, 세금계산서 품목, 장부·전표 산출물과 수행기간을 대조하세요.",
    },
    "재무제표 작성·회계처리 지원": {
      issue: "재무제표 대리작성·작성지원 또는 수정분개 제시 여부 확인",
      note:
        "결산·재무제표 관련 업무가 대리작성, 작성지원 또는 수정분개 제시에 해당할 수 있습니다. 계약서, 현금흐름표·연결분개 등 산출물과 회사 작성 증빙을 확인하세요.",
    },
    "가치평가·자산양수도": {
      issue: "가치평가·주요 자산 양수도 자문 여부 확인",
      note:
        "감사기간 중 가치평가 또는 주요 자산의 매수·매도 관련 자문·용역인지 확인해야 합니다. 계약서, 평가보고서, 거래 대상 자산과 수행기간을 확인하세요.",
    },
    "회계자문·컨설팅": {
      issue: "회계처리자문·재무정보 영향이 큰 컨설팅 여부 확인",
      note:
        "재무정보에 직접 영향을 미치는 회계처리자문 또는 컨설팅인지 확인해야 합니다. 계약서, 세금계산서 품목, 업무범위와 최종 산출물을 대조하세요.",
    },
    "인적용역·업무대행": {
      issue: "인적용역·업무대행의 재무정보 관여 여부 확인",
      note:
        "인력지원·급여대행 등으로 회사의 회계기록 또는 재무정보 작성에 관여했는지 확인해야 합니다. 파견인력 역할, 계약서와 산출물을 확인하세요.",
    },
    "기업진단·인증": {
      issue: "감사대상회사에 대한 별도 인증업무 수행 여부 확인",
      note:
        "외부감사와 기업진단 등 별도 인증업무가 동일 회사에 제공되었는지 확인해야 합니다. 각 계약서, 수행기간과 문서화된 독립성 검토 내역을 확인하세요.",
    },
    "업무성격 확인 필요": {
      issue: "업무 성격이 불명확하여 증빙 확인 필요",
      note:
        "적요만으로 비감사용역의 성격을 판단하기 어렵습니다. 계약서, 세금계산서 품목, 업무 산출물을 확인하여 기장·회계자문·재무제표 작성지원 여부를 판단하세요.",
    },
  };
  return (
    notes[serviceClass] ?? {
      issue: "독립성 관련 업무 여부 확인",
      note: "계약서, 세금계산서 품목과 업무 산출물을 확인하세요.",
    }
  );
}

export function analyzeIndependence(
  transactions: Transaction[],
  clients: AttestationClient[],
): AnalysisResult {
  const diagnostics = new Map<string, DiagnosticEvidence>();
  for (const transaction of transactions) {
    if (classifyService(transaction.memo, transaction.account, transaction.section).serviceClass !== "기업진단·인증") {
      continue;
    }
    const key = `${transaction.year}:${diagnosticKey(transaction)}`;
    if (key.endsWith(":")) continue;
    const current = diagnostics.get(key);
    const evidence = `${transaction.date} / ${transaction.memo} / ${new Intl.NumberFormat("ko-KR").format(transaction.amount)}원 / ${transaction.sourceLocation}`;
    if (current) {
      current.evidence.push(evidence);
    } else {
      const canonicalName = transaction.clientName;
      diagnostics.set(key, {
        client: {
          id: `diagnostic:${key}`,
          canonicalName,
          normalizedName: normalizeCompanyName(canonicalName),
          businessNumber: normalizeBusinessNumber(transaction.businessNumber),
          kind: "기업진단",
          year: transaction.year,
          source: "매출장 내 기업진단 거래",
        },
        evidence: [evidence],
      });
    }
  }

  const candidates: ReviewCandidate[] = [];
  let matchedTransactions = 0;
  for (const transaction of transactions) {
    const auditMatch = matchAttestationClient(transaction, clients);
    const diagnostic = diagnostics.get(`${transaction.year}:${diagnosticKey(transaction)}`);
    if (!auditMatch && !diagnostic) continue;
    matchedTransactions += 1;
    const classification = classifyService(
      transaction.memo,
      transaction.account,
      transaction.section,
    );
    if (
      ["허용 세무조정·세금신고", "외부감사", "기타"].includes(
        classification.serviceClass,
      )
    ) {
      continue;
    }
    if (classification.serviceClass === "기업진단·인증" && !auditMatch) continue;

    const targetKind: TargetKind =
      auditMatch && diagnostic
        ? "감사·기업진단"
        : auditMatch
          ? "외부감사"
          : "기업진단";
    const matchedCompany =
      auditMatch?.client.canonicalName ?? diagnostic?.client.canonicalName ?? transaction.clientName;
    const matchBasis = [
      auditMatch?.basis,
      diagnostic
        ? normalizeBusinessNumber(transaction.businessNumber)
          ? "기업진단 거래 사업자번호 일치"
          : "기업진단 거래 회사명 일치"
        : "",
    ]
      .filter(Boolean)
      .join(" / ");
    const guidance = buildNote(classification.serviceClass, targetKind);
    candidates.push({
      ...transaction,
      risk: classification.risk === "상" ? "상" : "중",
      serviceClass: classification.serviceClass,
      targetKind,
      matchedCompany,
      matchBasis,
      issue: guidance.issue,
      note: guidance.note,
      targetSource:
        auditMatch?.client.source ?? diagnostic?.client.source ?? "매출장 내 기업진단 거래",
      attestationEvidence:
        diagnostic?.evidence.slice(0, 3).join("; ") ?? auditMatch?.client.source ?? "",
    });
  }

  candidates.sort((a, b) =>
    a.year - b.year ||
    (a.risk === b.risk ? 0 : a.risk === "상" ? -1 : 1) ||
    normalizeCompanyName(a.matchedCompany).localeCompare(normalizeCompanyName(b.matchedCompany)) ||
    a.date.localeCompare(b.date),
  );
  return {
    candidates,
    summary: {
      totalTransactions: transactions.length,
      auditClients: clients.filter((client) => client.kind === "외부감사").length,
      diagnosticClients: diagnostics.size,
      matchedTransactions,
      candidateCount: candidates.length,
      highRiskCount: candidates.filter((candidate) => candidate.risk === "상").length,
    },
    warnings: [],
  };
}
