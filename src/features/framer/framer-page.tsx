import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import type { ExportQuality } from "./lib/state";
import { usePhotoFramer } from "./hooks/use-photo-framer";

export function FramerPage() {
  const {
    cyclePreview,
    downloadStatus,
    downloadZip,
    frameStatus,
    landscapeCanvasRef,
    onFrameChange,
    onPhotosChange,
    photoStatus,
    portraitCanvasRef,
    setExportQuality,
    setLandscapeOffset,
    setLandscapeScale,
    setPortraitOffset,
    setPortraitScale,
    state,
    uiState,
  } = usePhotoFramer();

  return (
    <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
      {/* Sidebar / Controls */}
      <aside className="flex shrink-0 flex-col border-b bg-card p-4 sm:p-6 lg:w-80 lg:border-r lg:border-b-0">
        <h1 className="mb-1 font-semibold text-lg tracking-tight">
          Photo Framer
        </h1>
        <p className="mb-5 text-muted-foreground text-xs">
          Batch compose photos onto branded frames
        </p>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
          {/* Frame Upload */}
          <div className="space-y-2">
            <Label htmlFor="frameInput">Frame Template</Label>
            <Input
              accept="image/*"
              id="frameInput"
              onChange={onFrameChange}
              type="file"
            />
            <p className="text-muted-foreground text-xs">{frameStatus}</p>
          </div>

          {/* Photos Upload */}
          <div className="space-y-2">
            <Label htmlFor="photoInput">Source Photos</Label>
            <Input
              accept="image/*"
              id="photoInput"
              multiple
              onChange={onPhotosChange}
              type="file"
            />
            <p className="text-muted-foreground text-xs">{photoStatus}</p>
          </div>

          {/* Portrait Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Portrait Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Scale</span>
                  <span className="font-medium tabular-nums">
                    {state.settings.portrait.scale.toFixed(2)}
                  </span>
                </div>
                <Slider
                  max={1}
                  min={0.1}
                  onValueChange={([v]) => {
                    if (v !== undefined) setPortraitScale(v);
                  }}
                  step={0.01}
                  value={[state.settings.portrait.scale]}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Offset</span>
                  <span className="font-medium tabular-nums">
                    {state.settings.portrait.offset.toFixed(2)}
                  </span>
                </div>
                <Slider
                  max={1}
                  min={-1}
                  onValueChange={([v]) => {
                    if (v !== undefined) setPortraitOffset(v);
                  }}
                  step={0.01}
                  value={[state.settings.portrait.offset]}
                />
              </div>
            </CardContent>
          </Card>

          {/* Landscape Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Landscape Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Scale</span>
                  <span className="font-medium tabular-nums">
                    {state.settings.landscape.scale.toFixed(2)}
                  </span>
                </div>
                <Slider
                  max={1}
                  min={0.1}
                  onValueChange={([v]) => {
                    if (v !== undefined) setLandscapeScale(v);
                  }}
                  step={0.01}
                  value={[state.settings.landscape.scale]}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Offset</span>
                  <span className="font-medium tabular-nums">
                    {state.settings.landscape.offset.toFixed(2)}
                  </span>
                </div>
                <Slider
                  max={1}
                  min={-1}
                  onValueChange={([v]) => {
                    if (v !== undefined) setLandscapeOffset(v);
                  }}
                  step={0.01}
                  value={[state.settings.landscape.offset]}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Export Controls */}
        <div className="mt-4 space-y-3 border-t pt-4">
          <div className="space-y-2">
            <Label>Export Quality</Label>
            <Select
              onValueChange={(v) => setExportQuality(v as ExportQuality)}
              value={state.exportQuality}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            disabled={uiState.downloadDisabled}
            onClick={downloadZip}
            size="lg"
          >
            <Download className="size-4" />
            Download All (ZIP)
          </Button>
          {downloadStatus && (
            <p className="text-center text-muted-foreground text-xs">
              {downloadStatus}
            </p>
          )}
        </div>
      </aside>

      {/* Preview Area */}
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="grid h-full gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Portrait Preview */}
          <PreviewPanel
            canvasRef={portraitCanvasRef}
            isLoading={uiState.portrait.isLoading}
            label="Portrait Preview"
            meta={uiState.portrait.meta}
            navDisabled={uiState.portrait.navDisabled}
            onNext={() => cyclePreview("portrait", 1)}
            onPrev={() => cyclePreview("portrait", -1)}
          />

          {/* Landscape Preview */}
          <PreviewPanel
            canvasRef={landscapeCanvasRef}
            isLoading={uiState.landscape.isLoading}
            label="Landscape Preview"
            meta={uiState.landscape.meta}
            navDisabled={uiState.landscape.navDisabled}
            onNext={() => cyclePreview("landscape", 1)}
            onPrev={() => cyclePreview("landscape", -1)}
          />
        </div>
      </main>
    </div>
  );
}

function PreviewPanel({
  canvasRef,
  isLoading,
  label,
  meta,
  navDisabled,
  onNext,
  onPrev,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isLoading: boolean;
  label: string;
  meta: string;
  navDisabled: boolean;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-2 border-b py-3">
        <CardTitle className="text-sm">{label}</CardTitle>
        <div className="flex items-center gap-2">
          <span className="hidden text-muted-foreground text-xs sm:inline">
            {meta}
          </span>
          <div className="flex gap-1">
            <Button
              className="size-7"
              disabled={navDisabled}
              onClick={onPrev}
              size="icon"
              variant="outline"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              className="size-7"
              disabled={navDisabled}
              onClick={onNext}
              size="icon"
              variant="outline"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative flex flex-1 items-center justify-center p-4">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        <canvas
          className={cn(
            "max-h-full max-w-full rounded-md object-contain",
            !isLoading && "block",
          )}
          ref={canvasRef}
        />
        <p className="text-muted-foreground text-xs sm:hidden">{meta}</p>
      </CardContent>
    </Card>
  );
}
