import preeti from "preeti";

const DEVANAGARI_RE = /[\u0900-\u097F]/;

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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
