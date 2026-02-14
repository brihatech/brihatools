import {
  FileSpreadsheet,
  FileText,
  FileUp,
  Loader2,
  Table2,
  XCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { usePdfExtractor } from "./hooks/use-pdf-extractor";

export function NepaliPdfPage() {
  const pdf = usePdfExtractor();

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      {/* Top bar: title + upload + export */}
      <div className="shrink-0 border-b bg-card px-3 py-3 sm:px-5 sm:py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          {/* Title */}
          <div className="shrink-0">
            <h1 className="font-semibold text-base tracking-tight sm:text-lg">
              Nepali PDF Extractor
            </h1>
            <p className="text-muted-foreground text-xs">
              Extract tables from PDF → CSV or Excel
            </p>
          </div>

          {/* Upload */}
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Label
              className={cn(
                "flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm transition sm:justify-start sm:py-2",
                "hover:border-primary/50 hover:bg-muted active:scale-[0.98]",
                pdf.busy && "pointer-events-none opacity-60",
                pdf.hasPdf && "border-primary bg-primary/5",
              )}
              htmlFor="pdfInput"
            >
              <FileUp className="size-5 shrink-0 sm:size-4" />
              <span className="line-clamp-1 text-center sm:text-left">
                {pdf.hasPdf ? pdf.pdfName : "Choose PDF file"}
              </span>
              {pdf.hasPdf && (
                <span className="hidden text-muted-foreground text-xs sm:inline">
                  ({pdf.pdfSizeKb} KB)
                </span>
              )}
            </Label>
            <input
              accept="application/pdf"
              className="sr-only"
              disabled={pdf.busy}
              id="pdfInput"
              onChange={pdf.onPdfChange}
              type="file"
            />
            {pdf.hasPdf && (
              <Button
                className="min-h-[44px] gap-2 text-xs sm:min-h-[36px]"
                disabled={pdf.busy}
                onClick={pdf.clearPdf}
                size="sm"
                variant="destructive"
              >
                <XCircleIcon className="size-4" />
                <span className="sm:inline">Clear</span>
              </Button>
            )}
          </div>

          {/* Export buttons */}
          <div className="flex shrink-0 gap-2">
            {(pdf.busy || pdf.processingText) && (
              <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
                {pdf.busy && <Loader2 className="size-3.5 animate-spin" />}
                <span>{pdf.processingText}</span>
              </div>
            )}
            <Button
              aria-label="Export as CSV"
              className="min-h-[44px] gap-2 sm:min-h-[36px]"
              disabled={!pdf.exportEnabled}
              onClick={pdf.downloadCsv}
              size="sm"
              variant={pdf.exportEnabled ? "default" : "outline"}
            >
              <FileText className="size-4" />
              <span>CSV</span>
            </Button>
            <Button
              aria-label="Export as Excel"
              className="min-h-[44px] gap-2 sm:min-h-[36px]"
              disabled={!pdf.exportEnabled}
              onClick={pdf.downloadXlsx}
              size="sm"
              variant={pdf.exportEnabled ? "default" : "outline"}
            >
              <FileSpreadsheet className="size-4" />
              <span>Excel</span>
            </Button>
          </div>
        </div>

        {pdf.exportStatus && (
          <p className="mx-auto mt-2 max-w-7xl text-muted-foreground text-xs">
            {pdf.exportStatus}
          </p>
        )}
      </div>

      {/* Processing overlay */}
      {pdf.busy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-card p-6 shadow-lg">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="font-medium text-sm">{pdf.processingText}</p>
          </div>
        </div>
      )}

      {/* Table preview area */}
      <div className="flex-1 overflow-auto">
        {pdf.header.length > 0 ? (
          <div className="mx-auto max-w-7xl px-3 py-3 sm:px-5 sm:py-4">
            {/* Meta bar */}
            <div className="mb-2 flex items-center gap-2">
              <Table2 className="size-4 text-muted-foreground" />
              {pdf.tableMeta && (
                <span className="text-muted-foreground text-xs">
                  {pdf.tableMeta}
                </span>
              )}
            </div>

            {/* Table */}
            <div className="relative overflow-x-auto rounded-lg border bg-card shadow-sm">
              {/* Scroll hint gradient for mobile */}
              {pdf.header.length > 3 && (
                <div className="pointer-events-none absolute top-0 right-0 z-20 h-full w-8 bg-gradient-to-l from-background/80 to-transparent sm:hidden" />
              )}
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b bg-muted/95 backdrop-blur-sm">
                  <tr>
                    {pdf.header.map((col, idx) => (
                      <th
                        className={cn(
                          "px-3 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider",
                          idx === 0 &&
                            "sticky left-0 z-10 bg-muted/95 shadow-[2px_0_4px_rgba(0,0,0,0.05)] backdrop-blur-sm",
                          idx > 0 && "whitespace-nowrap",
                        )}
                        key={`header-${idx.toString()}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pdf.rows.map((row, rIdx) => (
                    <tr
                      className="transition-colors hover:bg-muted/40"
                      key={`row-${rIdx.toString()}`}
                    >
                      {pdf.header.map((col, cIdx) => (
                        <td
                          className={cn(
                            "px-3 py-2 align-top",
                            cIdx === 0 &&
                              "sticky left-0 bg-card font-medium shadow-[2px_0_4px_rgba(0,0,0,0.05)]",
                            cIdx > 0 && "max-w-[200px] truncate",
                          )}
                          key={`${col}-${cIdx.toString()}`}
                          title={row[cIdx] ?? ""}
                        >
                          {row[cIdx] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Scroll hint for mobile */}
            {pdf.header.length > 3 && (
              <p className="mt-2 text-center text-muted-foreground text-xs sm:hidden">
                ← Scroll horizontally to view all columns →
              </p>
            )}

            {pdf.warning && (
              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-amber-700 text-xs dark:text-amber-400">
                  {pdf.warning}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-primary/10">
              <Table2 className="size-10 text-primary" />
            </div>
            <div className="max-w-sm">
              <p className="font-semibold text-base">Extract Tables from PDF</p>
              <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                Upload a PDF containing Nepali text tables. We'll extract and
                convert them to CSV or Excel format.
              </p>
            </div>
            <Button
              className="mt-2"
              disabled={pdf.busy}
              onClick={() => document.getElementById("pdfInput")?.click()}
              size="lg"
              variant="outline"
            >
              <FileUp className="mr-2 size-5" />
              Choose PDF File
            </Button>
            {pdf.warning && (
              <div className="mt-4 max-w-md rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-destructive text-xs">{pdf.warning}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
