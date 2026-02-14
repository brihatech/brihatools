import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImagePlus,
  Images,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
      {/* Sidebar */}
      <aside className="flex shrink-0 flex-col border-b bg-card p-4 sm:p-6 lg:w-72 lg:border-r lg:border-b-0">
        <h1 className="mb-1 font-semibold text-lg tracking-tight">
          Photo Framer
        </h1>
        <p className="mb-5 text-muted-foreground text-xs">
          Batch compose photos onto branded frames
        </p>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
          {/* Frame Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2" htmlFor="frameInput">
              <ImagePlus className="size-4 text-muted-foreground" />
              Frame / Background
            </Label>
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
            <Label className="flex items-center gap-2" htmlFor="photoInput">
              <Images className="size-4 text-muted-foreground" />
              Source Photos
            </Label>
            <Input
              accept="image/*"
              id="photoInput"
              multiple
              onChange={onPhotosChange}
              type="file"
            />
            <p className="text-muted-foreground text-xs">{photoStatus}</p>
          </div>

          {/* Export Quality */}
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
        </div>

        {/* Export Button */}
        <div className="mt-4 space-y-3 border-t pt-4">
          <Button
            className="w-full"
            disabled={uiState.downloadDisabled}
            onClick={downloadZip}
            size="lg"
          >
            <Download className="size-4" />
            Export
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
        <div className="grid h-full gap-6 lg:grid-cols-2">
          {/* Portrait Preview */}
          <PreviewPanel
            canvasRef={portraitCanvasRef}
            isLoading={uiState.portrait.isLoading}
            label="Portrait"
            meta={uiState.portrait.meta}
            navDisabled={uiState.portrait.navDisabled}
            offset={state.settings.portrait.offset}
            onNext={() => cyclePreview("portrait", 1)}
            onOffsetChange={setPortraitOffset}
            onPrev={() => cyclePreview("portrait", -1)}
            onScaleChange={setPortraitScale}
            scale={state.settings.portrait.scale}
          />

          {/* Landscape Preview */}
          <PreviewPanel
            canvasRef={landscapeCanvasRef}
            isLoading={uiState.landscape.isLoading}
            label="Landscape"
            meta={uiState.landscape.meta}
            navDisabled={uiState.landscape.navDisabled}
            offset={state.settings.landscape.offset}
            onNext={() => cyclePreview("landscape", 1)}
            onOffsetChange={setLandscapeOffset}
            onPrev={() => cyclePreview("landscape", -1)}
            onScaleChange={setLandscapeScale}
            scale={state.settings.landscape.scale}
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
  offset,
  onNext,
  onOffsetChange,
  onPrev,
  onScaleChange,
  scale,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isLoading: boolean;
  label: string;
  meta: string;
  navDisabled: boolean;
  offset: number;
  onNext: () => void;
  onOffsetChange: (v: number) => void;
  onPrev: () => void;
  onScaleChange: (v: number) => void;
  scale: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Navigation arrows + label */}
      <div className="flex items-center justify-center gap-3">
        <Button
          className="size-8"
          disabled={navDisabled}
          onClick={onPrev}
          size="icon"
          variant="outline"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="min-w-24 text-center">
          <span className="font-medium text-sm">{label}</span>
          <span className="ml-2 text-muted-foreground text-xs">{meta}</span>
        </div>
        <Button
          className="size-8"
          disabled={navDisabled}
          onClick={onNext}
          size="icon"
          variant="outline"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Canvas */}
      <div className="relative flex items-center justify-center overflow-hidden rounded-lg border bg-card p-3 shadow-sm">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        <canvas
          className={cn(
            "max-h-[50vh] max-w-full rounded-md object-contain lg:max-h-[60vh]",
            !isLoading && "block",
          )}
          ref={canvasRef}
        />
      </div>

      {/* Scale + Offset sliders */}
      <div className="space-y-3 rounded-lg border bg-card p-3 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Scale</span>
            <span className="font-medium tabular-nums">{scale.toFixed(2)}</span>
          </div>
          <Slider
            max={1}
            min={0.1}
            onValueChange={([v]) => {
              if (v !== undefined) onScaleChange(v);
            }}
            step={0.01}
            value={[scale]}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Offset</span>
            <span className="font-medium tabular-nums">
              {offset.toFixed(2)}
            </span>
          </div>
          <Slider
            max={1}
            min={-1}
            onValueChange={([v]) => {
              if (v !== undefined) onOffsetChange(v);
            }}
            step={0.01}
            value={[offset]}
          />
        </div>
      </div>
    </div>
  );
}
