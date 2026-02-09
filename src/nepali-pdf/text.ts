import preeti from "preeti";

const DEVANAGARI_RE = /[\u0900-\u097F]/;

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Like normalizeText, but preserves explicit newlines so multi-line table cells
// remain readable in CSV/Excel.
export function normalizeCellValue(text: string): string {
  const raw = String(text ?? "");
  const lines = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t\f\v]+/g, " ").trim())
    .filter(Boolean);
  return lines.join("\n");
}

export function maybePreetiToUnicode(text: string): string {
  if (DEVANAGARI_RE.test(text)) return text;

  const compact = text.replace(/\s+/g, "");
  if (!compact) return text;

  if (/^[0-9+\-()/.,:]+$/.test(compact)) return text;

  const digits = (compact.match(/[0-9]/g) ?? []).length;
  if (compact.length > 0 && digits / compact.length >= 0.6) return text;

  try {
    const converted = (
      preeti as unknown as (v: string, font?: string) => string
    )(text);
    return DEVANAGARI_RE.test(converted) ? converted : text;
  } catch {
    return text;
  }
}
