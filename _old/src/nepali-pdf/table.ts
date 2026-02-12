import type { ExtractedCell, ExtractedRow } from "./types";
import { normalizeCellValue, normalizeText } from "./text";

function looksLikeMemberId(text: string): boolean {
  // Examples seen in source PDFs: 550022050100002/13-14
  const t = normalizeText(text);
  return /^[0-9]{6,}[0-9/-]*\/[0-9]{1,2}(?:-[0-9]{1,2})?$/.test(t);
}

function isRecordStartCell(row: ExtractedRow, idx: number): boolean {
  const cell = row.cells[idx];
  if (!cell) return false;

  const t = normalizeText(cell.text);
  if (!/^[0-9]{1,4}$/.test(t)) return false;

  // Prevent treating adjacent numeric columns (e.g. ward/cluster codes) as
  // new record starts. A new record usually begins after a big X jump.
  const prev = row.cells[idx - 1];
  if (prev && cell.x - prev.x < 60) return false;

  // Find an ID-like value to the right within a bounded X distance. This is more
  // robust than relying on PDF text item ordering.
  for (const next of row.cells) {
    if (!next) continue;
    if (next.x <= cell.x) continue;
    if (next.x - cell.x > 320) continue;
    if (looksLikeMemberId(next.text)) return true;
  }

  return false;
}

function clusterXs(xs: number[], tol: number): number[] {
  const sorted = [...xs]
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => a - b);
  const clusters: Array<{ x: number; count: number }> = [];
  for (const x of sorted) {
    const last = clusters[clusters.length - 1];
    if (!last || Math.abs(x - last.x) > tol) {
      clusters.push({ x, count: 1 });
    } else {
      last.x = (last.x * last.count + x) / (last.count + 1);
      last.count++;
    }
  }
  return clusters.map((c) => c.x);
}

function explodeMultiRecordRow(row: ExtractedRow): ExtractedRow[] {
  // If a visual row contains multiple records side-by-side, the PDF will often
  // repeat the serial+memberId pattern at different X offsets.
  const startXs: number[] = [];

  // Preferred signal: member-id cells tend to be stable. For each member-id cell,
  // locate the closest serial-like number immediately to its left.
  const idCells = row.cells.filter((c) => looksLikeMemberId(c.text));
  if (idCells.length >= 2) {
    const idAnchors = clusterXs(
      idCells.map((c) => c.x),
      40,
    ).sort((a, b) => a - b);

    const gaps = idAnchors.slice(1).map((x, i) => x - idAnchors[i]);
    const maxGap = gaps.length ? Math.max(...gaps) : 0;

    // If member IDs appear in clearly separated bands, treat the row as containing
    // multiple records and split by anchor midpoints.
    if (idAnchors.length >= 2 && maxGap >= 160) {
      const boundaries: number[] = [];
      for (let i = 0; i < idAnchors.length - 1; i++) {
        boundaries.push((idAnchors[i] + idAnchors[i + 1]) / 2);
      }

      const blocks: ExtractedRow[] = [];
      for (let bi = 0; bi < idAnchors.length; bi++) {
        const left = bi === 0 ? -Infinity : (boundaries[bi - 1] ?? -Infinity);
        const right =
          bi === idAnchors.length - 1 ? Infinity : (boundaries[bi] ?? Infinity);

        const cells = row.cells.filter((c) => c.x > left && c.x <= right);
        if (cells.length < 4) continue;

        const minX = Math.min(...cells.map((c) => c.x));
        const normalized = cells.map((c) => ({ ...c, x: c.x - minX }));
        normalized.sort((a, b) => a.x - b.x);
        blocks.push({ page: row.page, y: row.y, cells: normalized });
      }

      if (blocks.length >= 2) return blocks;
    }

    // Otherwise try to find serial positions near each ID (some PDFs keep those close).
    for (const idCell of idCells) {
      let bestX: number | null = null;
      let bestDist = Infinity;
      for (const c of row.cells) {
        if (c.x >= idCell.x) continue;
        const dist = idCell.x - c.x;
        if (dist > 260) continue;
        if (!/^[0-9]{1,4}$/.test(normalizeText(c.text))) continue;
        if (dist < bestDist) {
          bestDist = dist;
          bestX = c.x;
        }
      }
      if (typeof bestX === "number") startXs.push(bestX);
    }
  }

  // Fallback: scan for serial cells that look like record starts.
  if (startXs.length === 0) {
    for (let i = 0; i < row.cells.length; i++) {
      if (isRecordStartCell(row, i)) startXs.push(row.cells[i].x);
    }
  }

  const starts = clusterXs(startXs, 18).sort((a, b) => a - b);
  if (starts.length <= 1) return [row];

  // Only treat as multi-record if the record blocks are clearly separated.
  const gaps = starts.slice(1).map((x, i) => x - starts[i]);
  const maxGap = gaps.length ? Math.max(...gaps) : 0;
  if (maxGap < 140) return [row];

  const blocks: ExtractedRow[] = [];
  for (let bi = 0; bi < starts.length; bi++) {
    const left = starts[bi];
    const right = bi === starts.length - 1 ? Infinity : starts[bi + 1];

    const cells = row.cells
      .filter((c) => c.x >= left - 1 && c.x < right - 1)
      .map((c) => ({ ...c, x: c.x - left }));

    if (cells.length >= 4) {
      cells.sort((a, b) => a.x - b.x);
      blocks.push({ page: row.page, y: row.y, cells });
    }
  }

  return blocks.length ? blocks : [row];
}

export function explodeMultiRecordRows(rows: ExtractedRow[]): ExtractedRow[] {
  const out: ExtractedRow[] = [];
  for (const r of rows) out.push(...explodeMultiRecordRow(r));
  // Preserve the original document ordering.
  out.sort((a, b) => a.page - b.page || b.y - a.y);
  return out;
}

function isHeaderLikeToken(text: string): boolean {
  const t = normalizeText(text);
  if (!t) return false;
  if (looksLikeMemberId(t)) return false;
  if (/^[0-9]{1,4}$/.test(t)) return false;

  // Keep only tokens that resemble header labels; this avoids capturing names
  // when the header line is merged with one or more data records.
  return /क्र\.?सं|क्रियाशील|क्रियाशिल|नम्बर|नं\.?|सदस्य|नाम|बाबु|आमा|आमाको|पति|पत्नी|लिङ्ग|लिंग|उमेर|समावेशी|समुह|समूह|शिक्षा|टोल|सम्पर्क|कैफियत|नामसारी/.test(
    t,
  );
}

export function sanitizeHeaderRow(row: ExtractedRow): ExtractedRow {
  // Some PDFs merge the header with one or more records on the same visual row.
  // In that case, keep only header-like tokens to avoid polluting the exported header.
  const kept = row.cells.filter((c) => isHeaderLikeToken(c.text));
  return kept.length >= 4 ? { page: row.page, y: row.y, cells: kept } : row;
}

function inferColumnStopsFromHeaderRow(headerRow: ExtractedRow): number[] {
  const xs = headerRow.cells
    .map((c) => c.x)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (xs.length < 2) return [];

  // Header text often comes as multiple small cells per label.
  // Treat a new column start only when there is a larger horizontal jump.
  const starts: number[] = [];
  let prev = -Infinity;
  for (const x of xs) {
    if (x - prev >= 34) {
      starts.push(x);
      prev = x;
    }
  }

  if (starts.length < 2) return [];
  const stops: number[] = [];
  for (let i = 0; i < starts.length - 1; i++) {
    stops.push((starts[i] + starts[i + 1]) / 2);
  }
  return stops;
}

export function groupIntoRows(
  cells: ExtractedCell[],
  yTolerance = 2.0,
): ExtractedRow[] {
  const sorted = [...cells].sort(
    (a, b) => a.page - b.page || b.y - a.y || a.x - b.x,
  );
  const rows: ExtractedRow[] = [];

  for (const cell of sorted) {
    const existing = rows.find(
      (r) => r.page === cell.page && Math.abs(r.y - cell.y) <= yTolerance,
    );
    if (existing) {
      existing.cells.push(cell);
      existing.y =
        (existing.y * (existing.cells.length - 1) + cell.y) /
        existing.cells.length;
    } else {
      rows.push({ page: cell.page, y: cell.y, cells: [cell] });
    }
  }

  for (const row of rows) row.cells.sort((a, b) => a.x - b.x);
  rows.sort((a, b) => a.page - b.page || b.y - a.y);
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
  if (row.cells.length < 4) return false;
  const hasSerialLike = row.cells.some((c) => /^[0-9]{1,4}$/.test(c.text));
  if (!hasSerialLike) return false;
  const hasMemberId = row.cells.some((c) => looksLikeMemberId(c.text));
  return hasMemberId;
}

export function findHeaderRowIndex(rows: ExtractedRow[]): number {
  return rows.findIndex(isHeaderRow);
}

export function inferColumnStopsFromDataRows(
  rows: ExtractedRow[],
  headerRow?: ExtractedRow,
): number[] {
  const sample = rows.filter(isLikelyDataRow).slice(0, 30);
  if (sample.length === 0) {
    return headerRow
      ? inferColumnStopsFromHeaderRow(sanitizeHeaderRow(headerRow))
      : [];
  }

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

  if (columnXs.length < 2) {
    return headerRow
      ? inferColumnStopsFromHeaderRow(sanitizeHeaderRow(headerRow))
      : [];
  }

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
    return [normalizeCellValue(row.cells.map((c) => c.text).join(" "))];
  }

  const cols: string[] = new Array(stops.length + 1).fill("");
  for (const cell of row.cells) {
    const idx = stops.findIndex((s) => cell.x < s);
    const colIndex = idx === -1 ? cols.length - 1 : idx;
    cols[colIndex] = normalizeCellValue(
      `${cols[colIndex]} ${cell.text}`.trim(),
    );
  }

  return cols.map(normalizeCellValue);
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

  table.push(rowToColumns(sanitizeHeaderRow(headerRow), stops));

  // Some PDFs place the header in the middle of a page or repeat it.
  // Collect data rows across the whole document while skipping header-like rows.
  for (let i = 0; i < rows.length; i++) {
    if (i === headerIdx) continue;
    const r = rows[i];
    if (!r) continue;
    if (isHeaderRow(r)) continue;
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
