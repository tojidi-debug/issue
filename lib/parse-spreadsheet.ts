import * as XLSX from "xlsx";
import type { AttestationClient, FileRole, ParsedFileResult, Transaction } from "./domain";
import { inferYearFromRows, parseAdaptiveSalesRows } from "./adaptive-sales";
import {
  cleanText,
  normalizeBusinessNumber,
  normalizeCompanyName,
  normalizeCorporateNumber,
  parseDateValue,
  toNumber,
} from "./normalize";

type Row = unknown[];

export interface SalesRowContext {
  accountant: string;
  year: number;
  sourceFile: string;
  sheetName: string;
}

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["전표일자", "일자", "날짜"],
  voucherNo: ["번호", "전표번호"],
  clientName: ["거래처", "거래처명", "회사명"],
  businessNumber: ["사업자주민번호", "사업자등록번호", "사업자번호"],
  corporateNumber: ["법인등록번호", "법인번호"],
  memo: ["품명", "적요", "적요란", "내용"],
  account: ["계정과목", "계정명"],
  section: ["구분"],
  amount: ["공급가액", "대변", "금액"],
  vat: ["부가세", "세액"],
  total: ["합계", "총액"],
};

function headerKey(value: unknown): string {
  return cleanText(value).replace(/[\s()[\]·]/g, "");
}

function isNonExternalAudit(...values: unknown[]): boolean {
  const text = values.map(cleanText).join(" ");
  return /아파트|공동\s*주택|주택법|비외감|비\s*외감|임의\s*감사|자율\s*감사/i.test(text);
}

function findHeader(rows: Row[]): { rowIndex: number; indexes: Record<string, number> } | null {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 50); rowIndex += 1) {
    const keys = rows[rowIndex].map(headerKey);
    const indexes: Record<string, number> = {};
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      const index = keys.findIndex((key) => aliases.includes(key));
      if (index >= 0) indexes[field] = index;
    }
    if (
      indexes.date !== undefined &&
      indexes.clientName !== undefined &&
      indexes.memo !== undefined &&
      indexes.amount !== undefined
    ) {
      return { rowIndex, indexes };
    }
  }
  return null;
}

function valueAt(row: Row, indexes: Record<string, number>, field: string): unknown {
  const index = indexes[field];
  return index === undefined ? undefined : row[index];
}

export function parseSalesRows(rows: Row[], context: SalesRowContext): Transaction[] {
  const header = findHeader(rows);
  if (!header) return parseAdaptiveSalesRows(rows, context);
  const transactions: Transaction[] = [];
  for (let rowIndex = header.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const date = parseDateValue(valueAt(row, header.indexes, "date"), context.year);
    const clientName = cleanText(valueAt(row, header.indexes, "clientName"));
    const memo = cleanText(valueAt(row, header.indexes, "memo"));
    const amount = toNumber(valueAt(row, header.indexes, "amount"));
    const vat = toNumber(valueAt(row, header.indexes, "vat"));
    const explicitTotal = valueAt(row, header.indexes, "total");
    if (!date || !clientName || !/[A-Za-z가-힣]/.test(clientName)) continue;
    if (!memo && amount === 0 && vat === 0) continue;
    transactions.push({
      id: `${context.sourceFile}:${context.sheetName}:${rowIndex + 1}`,
      year: Number(date.slice(0, 4)),
      date,
      voucherNo: cleanText(valueAt(row, header.indexes, "voucherNo")),
      clientName,
      businessNumber: normalizeBusinessNumber(valueAt(row, header.indexes, "businessNumber")),
      corporateNumber: normalizeCorporateNumber(
        valueAt(row, header.indexes, "corporateNumber"),
      ),
      memo,
      account: cleanText(valueAt(row, header.indexes, "account")),
      section: cleanText(valueAt(row, header.indexes, "section")),
      amount,
      vat,
      total:
        explicitTotal === undefined || cleanText(explicitTotal) === ""
          ? amount + vat
          : toNumber(explicitTotal),
      accountant: context.accountant,
      sourceFile: context.sourceFile,
      sourceSheet: context.sheetName,
      sourceLocation: `${context.sourceFile} / ${context.sheetName}!${rowIndex + 1}`,
    });
  }
  return transactions;
}

function buildLegacyTransaction(
  context: SalesRowContext,
  row: Row,
  rowIndex: number,
  mapping: {
    date: number;
    voucherNo?: number;
    clientName: number;
    memo: number;
    amount: number;
    vat?: number;
    total?: number;
    section?: number;
  },
  account = "",
): Transaction | null {
  const date = parseDateValue(row[mapping.date], context.year);
  const clientName = cleanText(row[mapping.clientName]);
  const memo = cleanText(row[mapping.memo]);
  const amount = toNumber(row[mapping.amount]);
  const vat = mapping.vat === undefined ? 0 : toNumber(row[mapping.vat]);
  if (!date || !clientName || !/[A-Za-z가-힣]/.test(clientName)) return null;
  return {
    id: `${context.sourceFile}:${context.sheetName}:${rowIndex + 1}`,
    year: Number(date.slice(0, 4)),
    date,
    voucherNo: mapping.voucherNo === undefined ? "" : cleanText(row[mapping.voucherNo]),
    clientName,
    businessNumber: "",
    corporateNumber: "",
    memo,
    account,
    section: mapping.section === undefined ? "매출" : cleanText(row[mapping.section]),
    amount,
    vat,
    total:
      mapping.total === undefined || cleanText(row[mapping.total]) === ""
        ? amount + vat
        : toNumber(row[mapping.total]),
    accountant: context.accountant,
    sourceFile: context.sourceFile,
    sourceSheet: context.sheetName,
    sourceLocation: `${context.sourceFile} / ${context.sheetName}!${rowIndex + 1}`,
  };
}

export function parseLegacySalesRows(rows: Row[], context: SalesRowContext): Transaction[] {
  const result: Transaction[] = [];
  const add = (
    row: Row,
    rowIndex: number,
    mapping: Parameters<typeof buildLegacyTransaction>[3],
    account = "",
  ) => {
    const transaction = buildLegacyTransaction(context, row, rowIndex, mapping, account);
    if (transaction) result.push(transaction);
  };
  rows.forEach((row, rowIndex) => {
    if (context.sheetName === "김진태") {
      add(
        row,
        rowIndex,
        context.year === 2024
          ? { date: 0, memo: 1, clientName: 3, amount: 4, vat: 5, total: 6, section: 7 }
          : { date: 0, memo: 2, clientName: 5, amount: 7, vat: 9, total: 11, section: 12 },
      );
    } else if (["박명섭", "이정현"].includes(context.sheetName)) {
      add(row, rowIndex, {
        voucherNo: 0,
        date: 1,
        memo: 2,
        clientName: 3,
        amount: 4,
        vat: 5,
      });
    } else if (context.sheetName === "홍호성") {
      add(row, rowIndex, { date: 0, memo: 1, clientName: 2, amount: 4, voucherNo: 6 }, "기장수수료");
    }
  });
  return result;
}

export function parseAttestationRows(
  rows: Row[],
  sheetName: string,
  sourceFile = "",
): AttestationClient[] {
  let headerIndex = -1;
  let indexes: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 50); i += 1) {
    const keys = rows[i].map(headerKey);
    const companyIndex = keys.findIndex((key) =>
      ["회사명", "계약회사명", "감사대상회사"].includes(key),
    );
    if (companyIndex < 0) continue;
    headerIndex = i;
    indexes = {
      company: companyIndex,
      business: keys.findIndex((key) => ["사업자등록번호", "사업자번호"].includes(key)),
      corporate: keys.findIndex((key) => ["법인등록번호", "법인번호"].includes(key)),
      relationship: keys.findIndex((key) => ["관계", "구분", "연결관계"].includes(key)),
    };
    break;
  }
  if (headerIndex < 0) return [];

  const kind = /기업\s*진단|인증/.test(sheetName) ? "기업진단" : "외부감사";
  const clients: AttestationClient[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const canonicalName = cleanText(row[indexes.company]);
    const normalizedName = normalizeCompanyName(canonicalName);
    if (isNonExternalAudit(sourceFile, sheetName, ...row)) continue;
    if (!canonicalName || normalizedName.length < 2 || /회사명|해당사항없음/.test(canonicalName)) {
      continue;
    }
    clients.push({
      id: `${sourceFile}:${sheetName}:${rowIndex + 1}`,
      canonicalName,
      normalizedName,
      businessNumber:
        indexes.business >= 0 ? normalizeBusinessNumber(row[indexes.business]) : "",
      corporateNumber:
        indexes.corporate >= 0 ? normalizeCorporateNumber(row[indexes.corporate]) : "",
      kind,
      source: `${sourceFile || "업로드 파일"} / ${sheetName}!${rowIndex + 1}`,
      relatedTo:
        indexes.relationship >= 0 ? cleanText(row[indexes.relationship]) : undefined,
    });
  }
  return clients;
}

function parseReferenceFallback(
  rows: Row[],
  sheetName: string,
  sourceFile: string,
): AttestationClient[] {
  const clients: AttestationClient[] = [];
  const add = (nameValue: unknown, businessValue: unknown, rowIndex: number, detail = "") => {
    const canonicalName = cleanText(nameValue);
    const normalizedName = normalizeCompanyName(canonicalName);
    if (
      !canonicalName ||
      normalizedName.length < 2 ||
      isNonExternalAudit(sourceFile, sheetName, canonicalName, detail)
    ) return;
    clients.push({
      id: `${sourceFile}:${sheetName}:${rowIndex + 1}:${clients.length}`,
      canonicalName,
      normalizedName,
      businessNumber: normalizeBusinessNumber(businessValue),
      corporateNumber: "",
      kind: "외부감사",
      source: `${sourceFile} / ${sheetName}!${rowIndex + 1}`,
      relatedTo: detail || undefined,
    });
  };
  if (sheetName.startsWith("7-1_")) {
    add(sheetName.slice(4), "", 0, "감사조서 시트명");
  } else if (sheetName === "choosecols") {
    rows.slice(1).forEach((row, index) => {
      add(row[1], row[2], index + 1);
      add(row[5], row[6], index + 1);
    });
  } else if (sheetName === "Sheet2") {
    rows.slice(1).forEach((row, index) => {
      if (cleanText(row[3]).includes("감사보고서")) add(row[1], row[2], index + 1);
    });
  }
  return clients;
}

function detectYear(fileName: string, fallback?: number): number | undefined {
  if (fallback) return fallback;
  const full = fileName.match(/20\d{2}/);
  if (full) return Number(full[0]);
  const short = fileName.match(/(?:^|\D)(\d{2})(?:년|\D|$)/);
  return short ? 2000 + Number(short[1]) : undefined;
}

function isPreReviewAuditSheet(fileName: string, sheetName: string): boolean {
  if (!/사전\s*감리\s*자료/.test(fileName)) return true;
  return /^(?:2-1[.\s_-])|외부\s*감사\s*(?:수행\s*)?회사|외감\s*회사/i.test(sheetName);
}

export async function parseSpreadsheet(
  file: File,
  role: FileRole,
  override: { year?: number; accountant?: string } = {},
): Promise<ParsedFileResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const fileYear = detectYear(file.name, override.year);
  const transactions: Transaction[] = [];
  const clients: AttestationClient[] = [];

  for (const sheetName of workbook.SheetNames) {
    if (role === "reference" && !isPreReviewAuditSheet(file.name, sheetName)) continue;
    const rows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: "",
    });
    if (role === "sales") {
      const sheetYear =
        override.year ??
        detectYear(sheetName) ??
        fileYear ??
        inferYearFromRows(rows);
      if (!sheetYear) continue;
      const context = {
        accountant: override.accountant || sheetName,
        year: sheetYear,
        sourceFile: file.name,
        sheetName,
      };
      const standard = parseSalesRows(rows, context);
      transactions.push(
        ...(standard.length > 0 ? standard : parseLegacySalesRows(rows, context)),
      );
    } else if (role === "reference") {
      const standard = parseAttestationRows(rows, sheetName, file.name);
      clients.push(
        ...(standard.length > 0 ? standard : parseReferenceFallback(rows, sheetName, file.name)),
      );
    }
  }

  const warnings: ParsedFileResult["warnings"] = [];
  if ((role === "sales" ? transactions.length : clients.length) === 0) {
    warnings.push({
      code: "UNRECOGNIZED_LAYOUT",
      message: "지원하는 표 머리글 또는 대상 시트를 찾지 못했습니다.",
    });
  }
  return {
    fileName: file.name,
    role,
    transactions,
    clients,
    warnings,
    detectedYear:
      fileYear ??
      (new Set(transactions.map((transaction) => transaction.year)).size === 1
        ? transactions[0]?.year
        : undefined),
    detectedAccountant: override.accountant,
    amountTotal: transactions.reduce((sum, item) => sum + item.amount, 0),
  };
}
