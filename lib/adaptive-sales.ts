import type { Transaction } from "./domain";
import {
  cleanText,
  normalizeBusinessNumber,
  normalizeCorporateNumber,
  parseDateValue,
  toNumber,
} from "./normalize";

type Row = unknown[];

export interface AdaptiveSalesContext {
  accountant: string;
  year: number;
  sourceFile: string;
  sheetName: string;
}

type Layout = {
  date: number;
  voucherNo?: number;
  clientName: number;
  memo: number;
  account?: number;
  businessNumber?: number;
  corporateNumber?: number;
  section?: number;
  amount: number;
  vat?: number;
  total?: number;
};

const FIELD_ALIASES: Record<string, string[]> = {
  date: ["전표일자", "일자", "날짜"],
  voucherNo: ["번호", "전표번호"],
  businessNumber: ["사업자주민번호", "사업자등록번호", "사업자번호"],
  corporateNumber: ["법인등록번호", "법인번호"],
  section: ["구분"],
  account: ["계정과목", "계정명"],
  memo: ["품목", "적요", "적요란", "내용", "거래내용", "매출상세"],
  amount: ["공급가액", "대변", "금액"],
  vat: ["부가가치세", "부가세", "세액"],
  total: ["합계", "총액"],
};

const SERVICE_TOKEN =
  "(?:\\d{2,4}년)?(?:\\d{1,2}월)?(?:장부대|기장료|기장수수료|세무조정(?:료|수수료)?|부가(?:가치)?세신고수수료|법인세신고수수료|종합소득세신고수수료|신고대리|세무신고(?:대리)?|결산료|감사보수|기업진단수수료|컨설팅수수료|용역수수료)";
const SERVICE_PATTERN = new RegExp(SERVICE_TOKEN, "i");
const SERVICE_FIRST_PATTERN = new RegExp(`^\\s*(${SERVICE_TOKEN})\\s+(.+?)\\s*$`, "i");
const SERVICE_LAST_PATTERN = new RegExp(`^\\s*(.+?)\\s+(${SERVICE_TOKEN})\\s*$`, "i");
const LEGAL_MARKER_PATTERN =
  /농업회사법인|농업법인|유한책임회사|주식회사|유한회사|\(\s*주\s*\)|\(\s*유\s*\)|㈜|㈲/i;
const COMPANY_HINT_PATTERN =
  /회사|법인|산업|공업|기업|건설|전자|테크|금속|개발|병원|조합|주유소|센터|상사|문화|에너지|기술|엔지니어링|모터|F\.?A/i;

function headerKey(value: unknown): string {
  return cleanText(value).replace(/[\s()[\]·_-]/g, "");
}

function columnCount(rows: Row[]): number {
  return rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
}

function findHeaderColumn(rows: Row[], aliases: string[]): number | undefined {
  const normalizedAliases = aliases.map(headerKey);
  const matches = new Map<number, number>();
  for (const row of rows) {
    row.forEach((value, column) => {
      if (normalizedAliases.includes(headerKey(value))) {
        matches.set(column, (matches.get(column) ?? 0) + 1);
      }
    });
  }
  return [...matches.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

function numericValues(rows: Row[], rowIndexes: number[], column: number): number[] {
  return rowIndexes
    .map((rowIndex) => {
      const raw = rows[rowIndex]?.[column];
      if (cleanText(raw) === "") return Number.NaN;
      const value = toNumber(raw);
      return Number.isFinite(value) ? value : Number.NaN;
    })
    .filter(Number.isFinite);
}

function inferAmountColumns(
  rows: Row[],
  dataRows: number[],
  dateColumn: number,
  excluded: Set<number>,
): Pick<Layout, "amount" | "vat" | "total"> | null {
  const explicitAmount = findHeaderColumn(rows, FIELD_ALIASES.amount);
  const explicitVat = findHeaderColumn(rows, FIELD_ALIASES.vat);
  const explicitTotal = findHeaderColumn(rows, FIELD_ALIASES.total);
  if (explicitAmount !== undefined) {
    return { amount: explicitAmount, vat: explicitVat, total: explicitTotal };
  }

  const candidates = Array.from({ length: columnCount(rows) }, (_, column) => column)
    .filter((column) => column !== dateColumn && !excluded.has(column))
    .map((column) => ({ column, values: numericValues(rows, dataRows, column) }))
    .filter(({ values }) => values.length >= Math.max(1, Math.ceil(dataRows.length * 0.6)));
  if (candidates.length === 0) return null;

  let bestRelationship:
    | { amount: number; vat: number; total: number; matches: number }
    | undefined;
  for (const amount of candidates) {
    for (const vat of candidates) {
      if (vat.column === amount.column) continue;
      for (const total of candidates) {
        if (total.column === amount.column || total.column === vat.column) continue;
        let matches = 0;
        for (const rowIndex of dataRows) {
          const amountValue = toNumber(rows[rowIndex]?.[amount.column]);
          const vatValue = toNumber(rows[rowIndex]?.[vat.column]);
          const totalValue = toNumber(rows[rowIndex]?.[total.column]);
          if (
            cleanText(rows[rowIndex]?.[amount.column]) !== "" &&
            cleanText(rows[rowIndex]?.[vat.column]) !== "" &&
            cleanText(rows[rowIndex]?.[total.column]) !== "" &&
            Math.abs(amountValue + vatValue - totalValue) <= 1
          ) {
            matches += 1;
          }
        }
        if (!bestRelationship || matches > bestRelationship.matches) {
          bestRelationship = {
            amount: amount.column,
            vat: vat.column,
            total: total.column,
            matches,
          };
        }
      }
    }
  }
  if (
    bestRelationship &&
    bestRelationship.matches >= Math.max(1, Math.ceil(dataRows.length * 0.6))
  ) {
    return bestRelationship;
  }

  const ranked = candidates
    .map(({ column, values }) => ({
      column,
      medianMagnitude:
        [...values].sort((left, right) => Math.abs(left) - Math.abs(right))[
          Math.floor(values.length / 2)
        ] ?? 0,
    }))
    .sort((left, right) => Math.abs(right.medianMagnitude) - Math.abs(left.medianMagnitude));
  return {
    amount: ranked[0].column,
    vat: ranked.length > 1 ? ranked[1].column : undefined,
  };
}

function inferTextColumns(
  rows: Row[],
  dataRows: number[],
  excluded: Set<number>,
  amountColumn: number,
): Pick<Layout, "clientName" | "memo"> | null {
  const columns = Array.from({ length: columnCount(rows) }, (_, column) => column)
    .filter((column) => !excluded.has(column))
    .map((column) => {
      const values = dataRows
        .map((rowIndex) => cleanText(rows[rowIndex]?.[column]))
        .filter((value) => value !== "" && /[A-Za-z가-힣]/.test(value));
      const serviceHits = values.filter((value) => SERVICE_PATTERN.test(value)).length;
      const companyHits = values.filter(
        (value) => LEGAL_MARKER_PATTERN.test(value) || COMPANY_HINT_PATTERN.test(value),
      ).length;
      return {
        column,
        values,
        serviceHits,
        companyHits,
        density: values.length / Math.max(1, dataRows.length),
        proximity: 1 / (1 + Math.abs(amountColumn - column)),
      };
    })
    .filter(({ density }) => density >= 0.5);
  if (columns.length === 0) return null;

  const explicitMemo = findHeaderColumn(rows, FIELD_ALIASES.memo);
  const memo =
    explicitMemo ??
    [...columns].sort(
      (left, right) =>
        right.serviceHits - left.serviceHits ||
        right.density - left.density ||
        right.proximity - left.proximity,
    )[0].column;

  const otherColumns = columns.filter(({ column }) => column !== memo);
  const client =
    [...otherColumns].sort(
      (left, right) =>
        right.companyHits - left.companyHits ||
        right.proximity - left.proximity ||
        right.density - left.density,
    )[0]?.column ?? memo;
  return { memo, clientName: client };
}

function inferLayout(rows: Row[], context: AdaptiveSalesContext): Layout | null {
  const width = columnCount(rows);
  const explicitDate = findHeaderColumn(rows, FIELD_ALIASES.date);
  const dateCounts = Array.from({ length: width }, (_, column) => ({
    column,
    count: rows.filter((row) => {
      const value = row[column];
      return (
        (value instanceof Date || typeof value === "string") &&
        parseDateValue(value, context.year) !== ""
      );
    }).length,
  })).sort((left, right) => right.count - left.count);
  const date =
    explicitDate === undefined
      ? dateCounts[0]
      : {
          column: explicitDate,
          count: rows.filter(
            (row) => parseDateValue(row[explicitDate], context.year) !== "",
          ).length,
        };
  if (!date || date.count === 0) return null;
  const dataRows = rows
    .map((row, rowIndex) => ({ rowIndex, date: parseDateValue(row[date.column], context.year) }))
    .filter(({ date: parsed }) => parsed !== "")
    .map(({ rowIndex }) => rowIndex);

  const optionalColumns = Object.fromEntries(
    ["voucherNo", "businessNumber", "corporateNumber", "section", "account"].map((field) => [
      field,
      findHeaderColumn(rows, FIELD_ALIASES[field]),
    ]),
  ) as Record<string, number | undefined>;
  const numericExcluded = new Set(
    [optionalColumns.voucherNo, optionalColumns.businessNumber, optionalColumns.corporateNumber]
      .filter((value): value is number => value !== undefined),
  );
  const amounts = inferAmountColumns(rows, dataRows, date.column, numericExcluded);
  if (!amounts) return null;
  const textExcluded = new Set(
    [
      date.column,
      amounts.amount,
      amounts.vat,
      amounts.total,
      optionalColumns.voucherNo,
      optionalColumns.businessNumber,
      optionalColumns.corporateNumber,
      optionalColumns.section,
    ].filter((value): value is number => value !== undefined),
  );
  const texts = inferTextColumns(rows, dataRows, textExcluded, amounts.amount);
  if (!texts) return null;
  return {
    date: date.column,
    ...optionalColumns,
    ...texts,
    ...amounts,
  };
}

export function splitCompositeDescription(value: unknown): {
  clientName: string;
  memo: string;
} {
  const text = cleanText(value);
  const serviceFirst = text.match(SERVICE_FIRST_PATTERN);
  if (serviceFirst) return { memo: serviceFirst[1], clientName: serviceFirst[2] };
  const serviceLast = text.match(SERVICE_LAST_PATTERN);
  if (serviceLast) return { clientName: serviceLast[1], memo: serviceLast[2] };

  const legalMarker = text.search(LEGAL_MARKER_PATTERN);
  if (legalMarker > 0) {
    const before = cleanText(text.slice(0, legalMarker));
    if (SERVICE_PATTERN.test(before)) {
      return { memo: before, clientName: cleanText(text.slice(legalMarker)) };
    }
  }
  return { clientName: text, memo: text };
}

export function inferYearFromRows(rows: Row[]): number | undefined {
  const counts = new Map<number, number>();
  for (const row of rows) {
    for (const value of row) {
      if (!(value instanceof Date) && typeof value !== "string") continue;
      const parsed = parseDateValue(value);
      const text = cleanText(value);
      const hinted = text.match(/(?:^|\D)(20(?:24|25|26)|(?:24|25)년)(?:\D|$)/);
      const year = parsed
        ? Number(parsed.slice(0, 4))
        : hinted
          ? Number(hinted[1].replace("년", "").replace(/^(\d{2})$/, "20$1"))
          : Number.NaN;
      if (Number.isInteger(year)) counts.set(year, (counts.get(year) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

export function parseAdaptiveSalesRows(
  rows: Row[],
  context: AdaptiveSalesContext,
): Transaction[] {
  const layout = inferLayout(rows, context);
  if (!layout) return [];
  const transactions: Transaction[] = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const date = parseDateValue(row[layout.date], context.year);
    if (!date) continue;
    const rawMemo = cleanText(row[layout.memo]);
    const rawClient = cleanText(row[layout.clientName]);
    const composite =
      layout.memo === layout.clientName
        ? splitCompositeDescription(rawMemo)
        : { memo: rawMemo, clientName: rawClient };
    if (!composite.clientName || !/[A-Za-z가-힣]/.test(composite.clientName)) continue;
    const amount = toNumber(row[layout.amount]);
    const vat = layout.vat === undefined ? 0 : toNumber(row[layout.vat]);
    const explicitTotal = layout.total === undefined ? "" : cleanText(row[layout.total]);
    if (!composite.memo && amount === 0 && vat === 0) continue;
    transactions.push({
      id: `${context.sourceFile}:${context.sheetName}:${rowIndex + 1}`,
      year: Number(date.slice(0, 4)),
      date,
      voucherNo:
        layout.voucherNo === undefined ? "" : cleanText(row[layout.voucherNo]),
      clientName: composite.clientName,
      businessNumber:
        layout.businessNumber === undefined
          ? ""
          : normalizeBusinessNumber(row[layout.businessNumber]),
      corporateNumber:
        layout.corporateNumber === undefined
          ? ""
          : normalizeCorporateNumber(row[layout.corporateNumber]),
      memo: composite.memo,
      account: layout.account === undefined ? "" : cleanText(row[layout.account]),
      section: layout.section === undefined ? "매출" : cleanText(row[layout.section]),
      amount,
      vat,
      total: explicitTotal === "" ? amount + vat : toNumber(row[layout.total!]),
      accountant: context.accountant,
      sourceFile: context.sourceFile,
      sourceSheet: context.sheetName,
      sourceLocation: `${context.sourceFile} / ${context.sheetName}!${rowIndex + 1}`,
    });
  }
  return transactions;
}
