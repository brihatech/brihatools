import * as XLSX from "xlsx";

import { basenameNoExt, downloadBlob } from "./download";
import { extractAllPagesFromPdfArrayBuffer } from "./pdf";
import {
  collectMainTable,
  findHeaderRowIndex,
  groupIntoRows,
  inferColumnStopsFromDataRows,
  toCsv,
} from "./table";
import {
  initUI,
  renderPreview,
  setBusy,
  setExportEnabled,
  setProcessingText,
} from "./ui";

let lastTable: string[][] | null = null;
let lastBaseName = "table";

const DEFAULT_Y_TOLERANCE = 2.0;
const DEFAULT_PREVIEW_ROWS = 40;

let extractRunId = 0;

async function extract(ui: ReturnType<typeof initUI>, runId: number) {
  const file = ui.pdfInput.files?.[0];
  if (!file) return;

  lastBaseName = basenameNoExt(file.name) || "table";
  ui.exportStatus.textContent = "";
  ui.warning.textContent = "";

  setBusy(ui, true);
  setExportEnabled(ui, false);

  try {
    const buf = await file.arrayBuffer();
    if (runId !== extractRunId) return;
    const cells = await extractAllPagesFromPdfArrayBuffer(buf);
    if (runId !== extractRunId) return;

    const rows = groupIntoRows(cells, DEFAULT_Y_TOLERANCE);

    const headerIdx = findHeaderRowIndex(rows);
    if (headerIdx === -1) {
      lastTable = null;
      ui.warning.textContent =
        "Could not find the table header row. If this PDF uses a different header text, this tool may need a header rule update.";
      setProcessingText(ui, "");
      return;
    }

    const stops = inferColumnStopsFromDataRows(
      rows.slice(headerIdx + 1),
      rows[headerIdx]!,
    );
    const table = collectMainTable(rows, stops, headerIdx);

    lastTable = table;
    setExportEnabled(ui, table.length > 1);

    renderPreview(ui, table, DEFAULT_PREVIEW_ROWS);

    if (stops.length === 0) {
      ui.warning.textContent =
        "Column boundaries were not confidently inferred; exported file may be single-column.";
    }
    setProcessingText(
      ui,
      table.length > 1 ? "Ready to download." : "No data rows found.",
    );
  } catch (err) {
    lastTable = null;
    setExportEnabled(ui, false);
    const message = err instanceof Error ? err.message : "Unknown error";
    ui.warning.textContent = `Extraction failed: ${message}`;
    setProcessingText(ui, "");
  } finally {
    if (runId === extractRunId) {
      setBusy(ui, false);
    }
  }
}

function downloadCsv(ui: ReturnType<typeof initUI>) {
  if (!lastTable) return;
  const csv = toCsv(lastTable);
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${lastBaseName}.csv`);
  ui.exportStatus.textContent = "Downloaded CSV (UTF-8 with BOM for Excel).";
}

function downloadXlsx(ui: ReturnType<typeof initUI>) {
  if (!lastTable) return;

  const ws = XLSX.utils.aoa_to_sheet(lastTable);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Table");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  downloadBlob(blob, `${lastBaseName}.xlsx`);
  ui.exportStatus.textContent = "Downloaded Excel.";
}

const ui = initUI();
setExportEnabled(ui, false);
setBusy(ui, false);

ui.pdfInput.addEventListener("change", () => {
  const file = ui.pdfInput.files?.[0];
  ui.pdfStatus.textContent = file
    ? `${file.name} (${Math.round(file.size / 1024)} KB)`
    : "No PDF selected";
  setExportEnabled(ui, false);
  lastTable = null;

  if (!file) {
    setProcessingText(ui, "");
    return;
  }

  extractRunId++;
  const runId = extractRunId;
  void extract(ui, runId);
});
ui.downloadCsv.addEventListener("click", () => downloadCsv(ui));
ui.downloadXlsx.addEventListener("click", () => downloadXlsx(ui));
