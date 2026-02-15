import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImagePlus,
  Images,
  Loader2,
} from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { usePinch } from "@/hooks/use-pinch";
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
            <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              Frame / Background
            </Label>
            <div className="group relative">
              <input
                accept="image/*"
                className="hidden"
                id="frameInput"
                onChange={onFrameChange}
                type="file"
              />
              <label
                className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-border border-dashed bg-muted/30 px-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
                htmlFor="frameInput"
              >
                <div className="rounded-full bg-background p-2 shadow-sm ring-1 ring-border transition-colors group-hover:ring-primary/20">
                  <ImagePlus className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <span className="text-center font-medium text-muted-foreground text-xs transition-colors group-hover:text-foreground">
                  Click to select frame
                </span>
              </label>
            </div>
            {frameStatus && (
              <p className="font-medium text-primary text-xs">{frameStatus}</p>
            )}
          </div>

          {/* Photos Upload */}
          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              Source Photos
            </Label>
            <div className="group relative">
              <input
                accept="image/*"
                className="hidden"
                id="photoInput"
                multiple
                onChange={onPhotosChange}
                type="file"
              />
              <label
                className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-border border-dashed bg-muted/30 px-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
                htmlFor="photoInput"
              >
                <div className="rounded-full bg-background p-2 shadow-sm ring-1 ring-border transition-colors group-hover:ring-primary/20">
                  <Images className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <span className="text-center font-medium text-muted-foreground text-xs transition-colors group-hover:text-foreground">
                  Click to select photos
                </span>
              </label>
            </div>
            {photoStatus && (
              <p className="font-medium text-primary text-xs">{photoStatus}</p>
            )}
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
  const pinch = usePinch(scale, onScaleChange, !navDisabled && !isLoading);
  const dragRef = useRef({ active: false, startOffset: 0, startX: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    if (navDisabled || isLoading) return;
    dragRef.current = { active: true, startOffset: offset, startX: e.clientX };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const deltaX = e.clientX - dragRef.current.startX;
    // Map pixel movement to offset range (-1 to 1)
    // Sensitivity: 500px = full range (approx)
    const newOffset = dragRef.current.startOffset + deltaX / 500;
    onOffsetChange(Math.max(-1, Math.min(1, newOffset)));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

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
      <div
        className="relative flex touch-none items-center justify-center overflow-hidden rounded-lg border bg-card p-3 shadow-sm"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onTouchEnd={pinch.onTouchEnd}
        onTouchMove={pinch.onTouchMove}
        onTouchStart={pinch.onTouchStart}
      >
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
