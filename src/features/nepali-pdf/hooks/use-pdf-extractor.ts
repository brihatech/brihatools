import { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";

import { basenameNoExt, downloadBlob } from "../lib/download";
import { extractAllPagesFromPdfArrayBuffer } from "../lib/pdf";
import {
  collectMainTable,
  explodeMultiRecordRows,
  findHeaderRowIndex,
  groupIntoRows,
  inferColumnStopsFromDataRows,
  sanitizeHeaderRow,
  toCsv,
} from "../lib/table";

const DEFAULT_Y_TOLERANCE = 2.0;
const DEFAULT_PREVIEW_ROWS = 40;
const MEMBER_ID_GLOBAL_RE = /[0-9]{6,}[0-9/-]*\/[0-9]{1,2}(?:-[0-9]{1,2})?/g;

function countMemberIdsInRowText(text: string): number {
  const m = text.match(MEMBER_ID_GLOBAL_RE);
  return m ? m.length : 0;
}

export function usePdfExtractor() {
  const [busy, setBusy] = useState(false);
  const [pdfName, setPdfName] = useState("");
  const [pdfSizeKb, setPdfSizeKb] = useState(0);
  const [processingText, setProcessingText] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [warning, setWarning] = useState("");
  const [tableMeta, setTableMeta] = useState("");
  const [header, setHeader] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);

  const lastTableRef = useRef<string[][] | null>(null);
  const lastBaseNameRef = useRef("table");
  const extractRunIdRef = useRef(0);

  const hasPdf = Boolean(pdfName);
  const exportEnabled = Boolean(
    lastTableRef.current && lastTableRef.current.length > 1,
  );

  const onPdfChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      setExportStatus("");
      setWarning("");
      setProcessingText("");
      setTableMeta("");
      setHeader([]);
      setRows([]);
      lastTableRef.current = null;

      if (!file) {
        setPdfName("");
        setPdfSizeKb(0);
        return;
      }

      setPdfName(file.name);
      setPdfSizeKb(Math.round(file.size / 1024));
      lastBaseNameRef.current = basenameNoExt(file.name) || "table";

      extractRunIdRef.current += 1;
      const runId = extractRunIdRef.current;
      setBusy(true);
      setProcessingText("Extracting…");

      try {
        const buf = await file.arrayBuffer();
        if (runId !== extractRunIdRef.current) return;
        const cells = await extractAllPagesFromPdfArrayBuffer(buf);
        if (runId !== extractRunIdRef.current) return;

        let groupedRows = groupIntoRows(cells, DEFAULT_Y_TOLERANCE);
        let normalizedRows = explodeMultiRecordRows(groupedRows);

        const mergedLike = groupedRows.filter((r) => {
          if (r.cells.length < 25) return false;
          const rowText = r.cells.map((c) => c.text).join(" ");
          return countMemberIdsInRowText(rowText) >= 2;
        });
        if (mergedLike.length >= 3) {
          groupedRows = groupIntoRows(cells, 0.8);
          normalizedRows = explodeMultiRecordRows(groupedRows);
        }

        const headerIdx = findHeaderRowIndex(normalizedRows);
        if (headerIdx === -1) {
          lastTableRef.current = null;
          setWarning(
            "Could not find the table header row. If this PDF uses a different header text, this tool may need a header rule update.",
          );
          setProcessingText("");
          return;
        }

        const headerRow = normalizedRows[headerIdx];
        if (!headerRow) {
          lastTableRef.current = null;
          setWarning("Header row index was out of bounds.");
          setProcessingText("");
          return;
        }

        const safeHeaderRow = sanitizeHeaderRow(headerRow);
        const dataCandidates = normalizedRows.filter((_, i) => i !== headerIdx);
        const stops = inferColumnStopsFromDataRows(
          dataCandidates,
          safeHeaderRow,
        );
        const table = collectMainTable(normalizedRows, stops, headerIdx);
        lastTableRef.current = table;

        const safeHeader = (table[0] ?? []).map(
          (cell, idx) => (cell || "").trim() || `Column ${idx + 1}`,
        );
        const body = table.slice(1, Math.max(1, DEFAULT_PREVIEW_ROWS));
        setHeader(safeHeader);
        setRows(body);
        setTableMeta(
          `${table.length - 1} data rows • ${safeHeader.length} columns`,
        );

        if (stops.length === 0) {
          setWarning(
            "Column boundaries were not confidently inferred; exported file may be single-column.",
          );
        }

        setProcessingText(
          table.length > 1 ? "Ready to download." : "No data rows found.",
        );
      } catch (err) {
        lastTableRef.current = null;
        const message = err instanceof Error ? err.message : "Unknown error";
        setWarning(`Extraction failed: ${message}`);
        setProcessingText("");
      } finally {
        if (runId === extractRunIdRef.current) {
          setBusy(false);
        }
      }
    },
    [],
  );

  const downloadCsv = useCallback(() => {
    if (!lastTableRef.current) return;
    const csv = toCsv(lastTableRef.current);
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `${lastBaseNameRef.current}.csv`);
    setExportStatus("Downloaded CSV (UTF-8 with BOM for Excel).");
  }, []);

  const downloadXlsx = useCallback(() => {
    if (!lastTableRef.current) return;
    const ws = XLSX.utils.aoa_to_sheet(lastTableRef.current);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Table");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, `${lastBaseNameRef.current}.xlsx`);
    setExportStatus("Downloaded Excel.");
  }, []);

  return {
    busy,
    downloadCsv,
    downloadXlsx,
    exportEnabled,
    exportStatus,
    hasPdf,
    header,
    onPdfChange,
    pdfName,
    pdfSizeKb,
    processingText,
    rows,
    tableMeta,
    warning,
  };
}
