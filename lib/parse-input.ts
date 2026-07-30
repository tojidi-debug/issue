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
