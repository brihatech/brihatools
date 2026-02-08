import type { ExtractedCell } from "./types";
import { maybePreetiToUnicode, normalizeText } from "./text";

type PdfJsTextItem = {
  str?: string;
  transform: number[];
  width: number;
  height?: number;
};

function getXY(item: PdfJsTextItem): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = item.transform;
  const fontHeight = Math.hypot(b, d);
  const fontWidthScale = Math.hypot(a, c);

  return {
    x: e,
    y: f,
    w: item.width * fontWidthScale,
    h: item.height || fontHeight,
  };
}

export async function extractAllPagesFromPdfArrayBuffer(
  data: ArrayBuffer,
): Promise<ExtractedCell[]> {
  // pdfjs-dist types/exports are a little inconsistent across versions/builds.
  // Keep this import local to avoid Vite optimizing it incorrectly.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const workerUrl = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.toString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data),
    verbosity: 0,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf = await loadingTask.promise;

  const all: ExtractedCell[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const numPages: number = pdf.numPages;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await pdf.getPage(pageNum);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textContent = await page.getTextContent();

    for (const it of textContent.items as unknown[]) {
      if (typeof it === "string") continue;
      const item = it as PdfJsTextItem;

      const raw = normalizeText(item.str ?? "");
      const t = maybePreetiToUnicode(raw);
      if (!t) continue;

      const { x, y, w, h } = getXY(item);
      all.push({ text: t, x, y, width: w, height: h });
    }
  }

  return all;
}
