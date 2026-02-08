export type NepaliPdfUI = {
  pdfInput: HTMLInputElement;
  pdfStatus: HTMLDivElement;
  processingStatus: HTMLDivElement;
  processingSpinner: HTMLSpanElement;
  processingText: HTMLSpanElement;
  downloadCsv: HTMLButtonElement;
  downloadXlsx: HTMLButtonElement;
  exportStatus: HTMLDivElement;
  previewHead: HTMLTableRowElement;
  previewBody: HTMLTableSectionElement;
  tableMeta: HTMLDivElement;
  warning: HTMLDivElement;
};

function mustGet<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

export function initUI(): NepaliPdfUI {
  return {
    pdfInput: mustGet<HTMLInputElement>("pdfInput"),
    pdfStatus: mustGet<HTMLDivElement>("pdfStatus"),
    processingStatus: mustGet<HTMLDivElement>("processingStatus"),
    processingSpinner: mustGet<HTMLSpanElement>("processingSpinner"),
    processingText: mustGet<HTMLSpanElement>("processingText"),
    downloadCsv: mustGet<HTMLButtonElement>("downloadCsv"),
    downloadXlsx: mustGet<HTMLButtonElement>("downloadXlsx"),
    exportStatus: mustGet<HTMLDivElement>("exportStatus"),
    previewHead: mustGet<HTMLTableRowElement>("previewHead"),
    previewBody: mustGet<HTMLTableSectionElement>("previewBody"),
    tableMeta: mustGet<HTMLDivElement>("tableMeta"),
    warning: mustGet<HTMLDivElement>("warning"),
  };
}

export function setBusy(ui: NepaliPdfUI, busy: boolean): void {
  ui.pdfInput.disabled = busy;
  ui.processingSpinner.classList.toggle("hidden", !busy);
  ui.processingText.textContent = busy ? "Extracting…" : "";
}

export function setProcessingText(ui: NepaliPdfUI, text: string): void {
  ui.processingSpinner.classList.add("hidden");
  ui.processingText.textContent = text;
}

export function setExportEnabled(ui: NepaliPdfUI, enabled: boolean): void {
  ui.downloadCsv.disabled = !enabled;
  ui.downloadXlsx.disabled = !enabled;
}

export function clearPreview(ui: NepaliPdfUI): void {
  ui.previewHead.replaceChildren();
  ui.previewBody.replaceChildren();
  ui.tableMeta.textContent = "";
  ui.warning.textContent = "";
}

export function renderPreview(
  ui: NepaliPdfUI,
  table: string[][],
  maxRows: number,
): void {
  clearPreview(ui);

  if (table.length === 0) {
    ui.warning.textContent = "No rows extracted.";
    return;
  }

  const header = table[0] ?? [];
  for (let i = 0; i < header.length; i++) {
    const th = document.createElement("th");
    th.className = "px-3 py-2 whitespace-nowrap";
    th.textContent = header[i] || `Column ${i + 1}`;
    ui.previewHead.appendChild(th);
  }

  const bodyRows = table.slice(1, Math.max(1, maxRows));
  for (const row of bodyRows) {
    const tr = document.createElement("tr");
    for (let i = 0; i < header.length; i++) {
      const td = document.createElement("td");
      td.className = "px-3 py-2 align-top";
      td.textContent = row[i] ?? "";
      tr.appendChild(td);
    }
    ui.previewBody.appendChild(tr);
  }

  ui.tableMeta.textContent = `${table.length - 1} data rows • ${header.length} columns`;
}
