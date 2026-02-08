import * as XLSX from "xlsx";

import { getAlpine, startAlpine } from "@/alpine";

import { basenameNoExt, downloadBlob } from "./download";
import { extractAllPagesFromPdfArrayBuffer } from "./pdf";
import {
  collectMainTable,
  findHeaderRowIndex,
  groupIntoRows,
  inferColumnStopsFromDataRows,
  toCsv,
} from "./table";

const DEFAULT_Y_TOLERANCE = 2.0;
const DEFAULT_PREVIEW_ROWS = 40;

const Alpine = getAlpine();

Alpine.data("nepaliPdfExtractor", () => {
  let extractRunId = 0;

  return {
    busy: false,

    pdfName: "",
    pdfSizeKb: 0,

    processingText: "",
    exportStatus: "",
    warning: "",
    tableMeta: "",

    header: [] as string[],
    rows: [] as string[][],

    lastTable: null as string[][] | null,
    lastBaseName: "table",

    get hasPdf() {
      return Boolean(this.pdfName);
    },

    get exportEnabled() {
      return Boolean(this.lastTable && this.lastTable.length > 1);
    },

    init() {
      // nothing
    },

    async onPdfChange(event: Event) {
      const file = (event.target as HTMLInputElement).files?.[0];

      this.exportStatus = "";
      this.warning = "";
      this.processingText = "";
      this.tableMeta = "";
      this.header = [];
      this.rows = [];
      this.lastTable = null;

      if (!file) {
        this.pdfName = "";
        this.pdfSizeKb = 0;
        return;
      }

      this.pdfName = file.name;
      this.pdfSizeKb = Math.round(file.size / 1024);
      this.lastBaseName = basenameNoExt(file.name) || "table";

      extractRunId += 1;
      const runId = extractRunId;
      this.busy = true;
      this.processingText = "Extracting…";

      try {
        const buf = await file.arrayBuffer();
        if (runId !== extractRunId) return;
        const cells = await extractAllPagesFromPdfArrayBuffer(buf);
        if (runId !== extractRunId) return;

        const groupedRows = groupIntoRows(cells, DEFAULT_Y_TOLERANCE);

        const headerIdx = findHeaderRowIndex(groupedRows);
        if (headerIdx === -1) {
          this.lastTable = null;
          this.warning =
            "Could not find the table header row. If this PDF uses a different header text, this tool may need a header rule update.";
          this.processingText = "";
          return;
        }

        const headerRow = groupedRows[headerIdx];
        if (!headerRow) {
          this.lastTable = null;
          this.warning = "Header row index was out of bounds.";
          this.processingText = "";
          return;
        }

        const stops = inferColumnStopsFromDataRows(
          groupedRows.slice(headerIdx + 1),
          headerRow,
        );
        const table = collectMainTable(groupedRows, stops, headerIdx);
        this.lastTable = table;

        const safeHeader = (table[0] ?? []).map(
          (cell, idx) => (cell || "").trim() || `Column ${idx + 1}`,
        );
        const body = table.slice(1, Math.max(1, DEFAULT_PREVIEW_ROWS));
        this.header = safeHeader;
        this.rows = body;

        this.tableMeta = `${table.length - 1} data rows • ${safeHeader.length} columns`;

        if (stops.length === 0) {
          this.warning =
            "Column boundaries were not confidently inferred; exported file may be single-column.";
        }

        this.processingText =
          table.length > 1 ? "Ready to download." : "No data rows found.";
      } catch (err) {
        this.lastTable = null;
        const message = err instanceof Error ? err.message : "Unknown error";
        this.warning = `Extraction failed: ${message}`;
        this.processingText = "";
      } finally {
        if (runId === extractRunId) {
          this.busy = false;
        }
      }
    },

    downloadCsv() {
      if (!this.lastTable) return;
      const csv = toCsv(this.lastTable);
      const bom = "\uFEFF";
      const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
      downloadBlob(blob, `${this.lastBaseName}.csv`);
      this.exportStatus = "Downloaded CSV (UTF-8 with BOM for Excel).";
    },

    downloadXlsx() {
      if (!this.lastTable) return;

      const ws = XLSX.utils.aoa_to_sheet(this.lastTable);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Table");

      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      downloadBlob(blob, `${this.lastBaseName}.xlsx`);
      this.exportStatus = "Downloaded Excel.";
    },
  };
});

startAlpine();
