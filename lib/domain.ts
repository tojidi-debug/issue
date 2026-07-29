export type FileRole = "reference" | "sales";
export type RiskLevel = "상" | "중" | "낮음";
export type TargetKind = "외부감사" | "기업진단" | "감사·기업진단";

export type ServiceClass =
  | "허용 세무조정·세금신고"
  | "외부감사"
  | "기업진단·인증"
  | "재무제표 작성·회계처리 지원"
  | "가치평가·자산양수도"
  | "기장·전표처리"
  | "인적용역·업무대행"
  | "회계자문·컨설팅"
  | "업무성격 확인 필요"
  | "기타";

export interface Transaction {
  id: string;
  year: number;
  date: string;
  voucherNo: string;
  clientName: string;
  businessNumber: string;
  memo: string;
  account: string;
  section: string;
  amount: number;
  vat: number;
  total: number;
  accountant: string;
  sourceFile: string;
  sourceSheet: string;
  sourceLocation: string;
}

export interface AttestationClient {
  id: string;
  canonicalName: string;
  normalizedName: string;
  businessNumber: string;
  kind: Exclude<TargetKind, "감사·기업진단">;
  year?: number;
  source: string;
  relatedTo?: string;
}

export interface ServiceClassification {
  serviceClass: ServiceClass;
  risk: RiskLevel;
  reviewRequired: boolean;
  reason: string;
}

export interface ReviewCandidate extends Transaction {
  risk: Exclude<RiskLevel, "낮음">;
  serviceClass: ServiceClass;
  targetKind: TargetKind;
  matchedCompany: string;
  matchBasis: string;
  issue: string;
  note: string;
  targetSource: string;
  attestationEvidence: string;
}

export interface ParseWarning {
  code:
    | "OCR_REQUIRED"
    | "UNSUPPORTED_FORMAT"
    | "ENCRYPTED_FILE"
    | "MISSING_SHEET"
    | "UNRECOGNIZED_LAYOUT"
    | "PARTIAL_PARSE"
    | "TOTAL_MISMATCH";
  message: string;
  location?: string;
}

export interface ParsedFileResult {
  fileName: string;
  role: FileRole;
  transactions: Transaction[];
  clients: AttestationClient[];
  warnings: ParseWarning[];
  detectedYear?: number;
  detectedAccountant?: string;
  amountTotal: number;
}

export interface AnalysisSummary {
  totalTransactions: number;
  auditClients: number;
  diagnosticClients: number;
  matchedTransactions: number;
  candidateCount: number;
  highRiskCount: number;
}

export interface AnalysisResult {
  candidates: ReviewCandidate[];
  summary: AnalysisSummary;
  warnings: string[];
}

export interface UploadedFileRecord {
  id: string;
  file: File;
  role: FileRole;
  status: "대기" | "처리중" | "완료" | "경고" | "실패";
  detectedYear?: number;
  detectedAccountant?: string;
  transactionCount?: number;
  amountTotal?: number;
  warnings: ParseWarning[];
  error?: string;
}

export const SUPPORTED_EXTENSIONS = ["pdf", "xls", "xlsx", "csv"] as const;
