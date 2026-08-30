import type { FileRole, ParsedFileResult } from "./domain";
import { SUPPORTED_EXTENSIONS } from "./domain";
import { parsePdf } from "./parse-pdf";
import { parseSpreadsheet } from "./parse-spreadsheet";

export class UnsupportedFileError extends Error {
  constructor(fileName: string) {
    super(`지원하지 않는 파일 형식입니다: ${fileName}`);
    this.name = "UnsupportedFileError";
  }
}

const REFERENCE_NAME_PATTERN =
  /사전\s*(?:제출|감리)|외부\s*감사|외감|수행\s*회사|계약서|기업\s*진단|수임|인증/i;
const SALES_NAME_PATTERN = /매출|원장|수수료|전표|거래장|계정별/i;

export interface AutoParsedFile {
  role: FileRole;
  result: ParsedFileResult;
}

export async function parseInputFileAuto(
  file: File,
  override?: { year?: number; accountant?: string },
): Promise<AutoParsedFile> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !SUPPORTED_EXTENSIONS.includes(extension as never)) {
    throw new UnsupportedFileError(file.name);
  }
  const nameSuggestsReference = REFERENCE_NAME_PATTERN.test(file.name);
  const nameSuggestsSales = SALES_NAME_PATTERN.test(file.name);
  if (extension === "pdf") {
    const role: FileRole = nameSuggestsSales && !nameSuggestsReference ? "sales" : "reference";
    return { role, result: await parsePdf(file, role, override) };
  }

  const reference = await parseSpreadsheet(file, "reference", override);
  const sales = await parseSpreadsheet(file, "sales", override);
  const role: FileRole =
    nameSuggestsReference && !nameSuggestsSales
      ? "reference"
      : nameSuggestsSales && !nameSuggestsReference
        ? "sales"
        : reference.clients.length > 0 && reference.clients.length >= sales.transactions.length
          ? "reference"
          : sales.transactions.length > 0
            ? "sales"
            : reference.clients.length > 0
              ? "reference"
              : nameSuggestsReference
                ? "reference"
                : "sales";
  return { role, result: role === "reference" ? reference : sales };
}

export async function parseInputFile(
  file: File,
  role: FileRole,
  override?: { year?: number; accountant?: string },
): Promise<ParsedFileResult> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !SUPPORTED_EXTENSIONS.includes(extension as never)) {
    throw new UnsupportedFileError(file.name);
  }
  if (extension === "pdf") return parsePdf(file, role, override);
  return parseSpreadsheet(file, role, override);
}
