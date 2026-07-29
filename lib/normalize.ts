const LEGAL_FORM_PATTERN =
  /농업회사법인|사회복지법인|영농조합법인|주식회사|유한회사|사단법인|재단법인|의료법인|\(주\)|\(유\)|\(사\)|㈜|㈔|법인/gi;

export function normalizeCompanyName(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .toLowerCase()
    .replace(LEGAL_FORM_PATTERN, "")
    .replace(/[^0-9a-z가-힣]/gi, "")
    .trim();
}

export function normalizeBusinessNumber(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  const formatted = text.match(/(?:^|\D)(\d{3})-?(\d{2})-?(\d{5})(?:\D|$)/);
  if (!formatted) return "";
  return `${formatted[1]}${formatted[2]}${formatted[3]}`;
}

function toIsoDate(year: number, month: number, day: number): string {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return "";
  }
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return "";
  }
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function parseDateValue(value: unknown, fallbackYear?: number): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + Math.floor(value) * 86_400_000);
    return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  const text = String(value ?? "").trim();
  let match = text.match(/^(20\d{2})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})(?:일)?$/);
  if (match) return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = text.match(/^(\d{1,2})[-./월]\s*(\d{1,2})(?:일)?$/);
  if (match && fallbackYear) {
    return toIsoDate(fallbackYear, Number(match[1]), Number(match[2]));
  }
  return "";
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .replace(/[,\s₩원]/g, "")
    .replace(/^\((.+)\)$/, "-$1");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
