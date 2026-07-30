import type { FileRole, ParsedFileResult, Transaction } from "./domain";
import { normalizeBusinessNumber, parseDateValue, toNumber } from "./normalize";

export interface PdfTextItem {
  text: string;
  x: number;
  y: number;
}

export interface PdfLine {
  y: number;
  items: PdfTextItem[];
  text: string;
}

export function groupPdfItemsIntoLines(
  items: PdfTextItem[],
  tolerance = 2.5,
): PdfLine[] {
  const lines: PdfLine[] = [];
  for (const item of items
    .slice()
    .sort((a, b) => (Math.abs(b.y - a.y) > tolerance ? b.y - a.y : a.x - b.x))) {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (!line) {
      line = { y: item.y, items: [], text: "" };
      lines.push(line);
    }
    line.items.push(item);
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      line.items.sort((a, b) => a.x - b.x);
      return {
        ...line,
        text: line.items
          .map((item) => item.text.trim())
          .filter(Boolean)
          .join(" "),
      };
    });
}

type ParsedLine = Partial<Transaction> & {
  date: string;
  clientName: string;
  memo: string;
  amount: number;
};

export function parseSalesLedgerLine(text: string): ParsedLine | null {
  const match = text
    .trim()
    .match(
      /^(\S+)\s+(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\s+(.+?)\s+(-?[\d,]+)\s+(-?[\d,]+)(?:\s+(-?[\d,]+))?$/,
    );
  if (!match) return null;
  const middle = match[3].trim();
  const companyStart = middle.search(
    /\(주\)|\(유\)|㈜|주식회사|유한회사|[A-Za-z가-힣0-9]+(?:건설|산업|기업|전자|금속|개발|공업|테크|법인)/,
  );
  if (companyStart <= 0) return null;
  const memo = middle.slice(0, companyStart).trim();
  const clientName = middle.slice(companyStart).trim();
  return {
    voucherNo: match[1],
    date: parseDateValue(match[2]),
    memo,
    clientName,
    amount: toNumber(match[4]),
    vat: toNumber(match[5]),
    total: match[6] ? toNumber(match[6]) : toNumber(match[4]) + toNumber(match[5]),
  };
}

export function parseAccountLedgerLine(
  text: string,
  year: number,
): ParsedLine | null {
  const match = text
    .trim()
    .match(
      /^(\d{1,2}[-/.]\d{1,2})\s+(.+?)\s+(\d{4,})\s+(.+?)\s+(-?[\d,]+)\s+(-?[\d,]+)$/,
    );
  if (!match) return null;
  return {
    date: parseDateValue(match[1], year),
    memo: match[2].trim(),
    voucherNo: match[3],
    clientName: match[4].trim(),
    amount: toNumber(match[5]),
    vat: 0,
    total: toNumber(match[5]),
  };
}

function yearFromName(name: string, fallback?: number): number | undefined {
  if (fallback) return fallback;
  const match = name.match(/20(24|25)|(?:^|\D)(24|25)년/);
  const captured = match?.[1] || match?.[2];
  return captured ? 2000 + Number(captured) : undefined;
}

export async function parsePdf(
  file: File,
  role: FileRole,
  override: { year?: number; accountant?: string } = {},
): Promise<ParsedFileResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const year = yearFromName(file.name, override.year);
  const transactions: Transaction[] = [];
  const warnings: ParsedFileResult["warnings"] = [];
  let textItemCount = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    try {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items
        .filter((item): item is typeof item & { str: string; transform: number[] } =>
          "str" in item && "transform" in item,
        )
        .map((item) => ({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
        }));
      textItemCount += items.length;
      if (role !== "sales" || !year) continue;
      for (const [lineIndex, line] of groupPdfItemsIntoLines(items).entries()) {
        const parsed =
          parseSalesLedgerLine(line.text) || parseAccountLedgerLine(line.text, year);
        if (!parsed?.date || !parsed.clientName) continue;
        transactions.push({
          id: `${file.name}:pdf:${pageNumber}:${lineIndex + 1}`,
          year: Number(parsed.date.slice(0, 4)),
          date: parsed.date,
          voucherNo: parsed.voucherNo ?? "",
          clientName: parsed.clientName,
          businessNumber: normalizeBusinessNumber(parsed.businessNumber),
          memo: parsed.memo,
          account: "",
          section: "매출",
          amount: parsed.amount,
          vat: parsed.vat ?? 0,
          total: parsed.total ?? parsed.amount,
          accountant: override.accountant ?? "",
          sourceFile: file.name,
          sourceSheet: `PDF p.${pageNumber}`,
          sourceLocation: `${file.name} / PDF p.${pageNumber}`,
        });
      }
    } catch (error) {
      warnings.push({
        code: "PARTIAL_PARSE",
        message: `PDF ${pageNumber}쪽을 읽지 못했습니다: ${String(error)}`,
        location: `PDF p.${pageNumber}`,
      });
    }
  }

  if (textItemCount < Math.max(5, pdf.numPages * 2)) {
    warnings.push({
      code: "OCR_REQUIRED",
      message: "텍스트가 거의 없어 이미지형 PDF로 보입니다. OCR 처리 후 다시 업로드하세요.",
    });
  }
  if (role === "reference") {
    warnings.push({
      code: "UNRECOGNIZED_LAYOUT",
      message: "PDF 기준자료는 표 구조에 따라 대상회사 자동 추출이 제한될 수 있습니다.",
    });
  }
  return {
    fileName: file.name,
    role,
    transactions,
    clients: [],
    warnings,
    detectedYear: year,
    detectedAccountant: override.accountant,
    amountTotal: transactions.reduce((sum, item) => sum + item.amount, 0),
  };
}
