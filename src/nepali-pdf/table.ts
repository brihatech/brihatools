import type { ExtractedCell, ExtractedRow } from "./types";
import { normalizeText } from "./text";

export function groupIntoRows(
  cells: ExtractedCell[],
  yTolerance = 2.0,
): ExtractedRow[] {
  const sorted = [...cells].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: ExtractedRow[] = [];

  for (const cell of sorted) {
    const existing = rows.find((r) => Math.abs(r.y - cell.y) <= yTolerance);
    if (existing) {
      existing.cells.push(cell);
      existing.y =
        (existing.y * (existing.cells.length - 1) + cell.y) /
        existing.cells.length;
    } else {
      rows.push({ y: cell.y, cells: [cell] });
    }
  }

  for (const row of rows) row.cells.sort((a, b) => a.x - b.x);
  rows.sort((a, b) => b.y - a.y);
  return rows;
}

function rowText(row: ExtractedRow): string {
  return normalizeText(row.cells.map((c) => c.text).join(" "));
}

function isHeaderRow(row: ExtractedRow): boolean {
  const t = rowText(row);
  return (
    t.includes("क्र.सं") || t.includes("क्रियाशील नं") || t.includes("सदस्यको नाम")
  );
}

function isLikelyDataRow(row: ExtractedRow): boolean {
  const left = row.cells[0];
  if (!left) return false;
  return left.x < 80 && /^[0-9]{1,4}$/.test(left.text);
}

export function findHeaderRowIndex(rows: ExtractedRow[]): number {
  return rows.findIndex(isHeaderRow);
}

export function inferColumnStopsFromDataRows(
  rows: ExtractedRow[],
  headerRow?: ExtractedRow,
): number[] {
  const sample = rows.filter(isLikelyDataRow).slice(0, 30);
  if (sample.length === 0) return [];

  const starts: number[] = [];
  for (const row of sample) {
    const xs = row.cells.map((c) => c.x).sort((a, b) => a - b);
    let prev = -Infinity;
    for (const x of xs) {
      if (x - prev >= 8) {
        starts.push(x);
        prev = x;
      }
    }
  }

  starts.sort((a, b) => a - b);

  const clusters: Array<{ x: number; count: number }> = [];
  const tol = 4;
  for (const x of starts) {
    const last = clusters[clusters.length - 1];
    if (!last || Math.abs(x - last.x) > tol) {
      clusters.push({ x, count: 1 });
    } else {
      last.x = (last.x * last.count + x) / (last.count + 1);
      last.count++;
    }
  }

  const minCount = Math.max(3, Math.floor(sample.length * 0.2));
  const columnXs = clusters.filter((c) => c.count >= minCount).map((c) => c.x);

  if (headerRow) {
    const headerXs = headerRow.cells.map((c) => c.x).sort((a, b) => a - b);
    const rightmost = headerXs[headerXs.length - 1];
    if (typeof rightmost === "number") {
      const maxData = columnXs.length ? Math.max(...columnXs) : -Infinity;
      const hasNear = columnXs.some((x) => Math.abs(x - rightmost) <= 8);
      if (!hasNear && rightmost > maxData + 12) {
        columnXs.push(rightmost);
      }
    }
  }

  if (columnXs.length < 2) return [];

  columnXs.sort((a, b) => a - b);
  const stops: number[] = [];
  for (let i = 0; i < columnXs.length - 1; i++) {
    const left = columnXs[i];
    const right = columnXs[i + 1];
    if (typeof left !== "number" || typeof right !== "number") {
      continue;
    }
    stops.push((left + right) / 2);
  }
  return stops;
}

export function rowToColumns(row: ExtractedRow, stops: number[]): string[] {
  if (stops.length === 0) {
    return [normalizeText(row.cells.map((c) => c.text).join(" "))];
  }

  const cols: string[] = new Array(stops.length + 1).fill("");
  for (const cell of row.cells) {
    const idx = stops.findIndex((s) => cell.x < s);
    const colIndex = idx === -1 ? cols.length - 1 : idx;
    cols[colIndex] = normalizeText(`${cols[colIndex]} ${cell.text}`.trim());
  }

  return cols.map(normalizeText);
}

export function collectMainTable(
  rows: ExtractedRow[],
  stops: number[],
  headerIdx: number,
): string[][] {
  const table: string[][] = [];

  const headerRow = rows[headerIdx];
  if (!headerRow) {
    return table;
  }

  table.push(rowToColumns(headerRow, stops));

  for (const r of rows.slice(headerIdx + 1)) {
    if (!isLikelyDataRow(r)) continue;
    table.push(rowToColumns(r, stops));
  }

  return table;
}

export function toCsv(rows: string[][]): string {
  const esc = (v: string) => {
    const needs = /[\n\r",]/.test(v);
    const s = v.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return needs ? `"${s.replace(/"/g, '""')}"` : s;
  };

  return `${rows.map((r) => r.map((c) => esc(c ?? "")).join(",")).join("\n")}\n`;
}
