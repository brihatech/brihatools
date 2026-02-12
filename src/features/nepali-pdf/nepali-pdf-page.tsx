import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { usePdfExtractor } from "./hooks/use-pdf-extractor";

export function NepaliPdfPage() {
  const pdf = usePdfExtractor();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <h1 className="font-semibold text-2xl sm:text-3xl">
          Nepali PDF Table Extractor
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Extract Nepali tables from PDF to Unicode CSV or Excel
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] lg:gap-8">
        {/* Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
              Input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="pdfInput">PDF file</Label>
              <Input
                accept="application/pdf"
                disabled={pdf.busy}
                id="pdfInput"
                onChange={pdf.onPdfChange}
                type="file"
              />
              <p className="text-muted-foreground text-xs">
                {pdf.hasPdf
                  ? `${pdf.pdfName} (${pdf.pdfSizeKb} KB)`
                  : "No PDF selected"}
              </p>
              {(pdf.busy || pdf.processingText) && (
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  {pdf.busy && <Loader2 className="size-4 animate-spin" />}
                  <span>{pdf.processingText}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t pt-6">
              <CardTitle className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
                Export
              </CardTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  className="h-auto justify-start gap-3 px-4 py-3"
                  disabled={!pdf.exportEnabled}
                  onClick={pdf.downloadCsv}
                  variant="outline"
                >
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <span className="flex flex-col items-start">
                    <span className="font-semibold text-xs uppercase tracking-widest">
                      Download CSV
                    </span>
                    <span className="text-muted-foreground text-xs">.csv</span>
                  </span>
                </Button>
                <Button
                  className="h-auto justify-start gap-3 px-4 py-3"
                  disabled={!pdf.exportEnabled}
                  onClick={pdf.downloadXlsx}
                  variant="outline"
                >
                  <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" />
                  <span className="flex flex-col items-start">
                    <span className="font-semibold text-xs uppercase tracking-widest">
                      Download Excel
                    </span>
                    <span className="text-muted-foreground text-xs">.xlsx</span>
                  </span>
                </Button>
              </div>
              {pdf.exportStatus && (
                <p className="text-muted-foreground text-xs">
                  {pdf.exportStatus}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
                  Preview
                </CardTitle>
                <p className="mt-1 text-muted-foreground text-sm">
                  Shows the first rows detected from the main table.
                </p>
              </div>
              {pdf.tableMeta && (
                <span className="text-muted-foreground text-xs">
                  {pdf.tableMeta}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-muted text-muted-foreground text-xs uppercase tracking-widest">
                  <tr>
                    {pdf.header.map((col, idx) => (
                      <th
                        className="whitespace-nowrap px-3 py-2"
                        key={`header-${idx.toString()}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pdf.rows.map((row, rIdx) => (
                    <tr key={`row-${rIdx.toString()}`}>
                      {pdf.header.map((col, cIdx) => (
                        <td
                          className="px-3 py-2 align-top"
                          key={`${col}-${cIdx.toString()}`}
                        >
                          {row[cIdx] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pdf.warning && (
              <p className="mt-3 text-muted-foreground text-xs">
                {pdf.warning}
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
