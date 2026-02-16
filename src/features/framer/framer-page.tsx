import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImagePlus,
  Images,
  Loader2,
} from "lucide-react";
import { type CSSProperties, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    onFrameChange,
    onPhotosChange,
    photoStatus,
    setExportQuality,
    setLandscapePan,
    setLandscapeScale,
    setPortraitPan,
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
            frameSrc={uiState.frameSrc}
            isLoading={uiState.portrait.isLoading}
            label="Portrait"
            meta={uiState.portrait.meta}
            navDisabled={uiState.portrait.navDisabled}
            onNext={() => cyclePreview("portrait", 1)}
            onPanChange={setPortraitPan}
            onPrev={() => cyclePreview("portrait", -1)}
            onScaleChange={setPortraitScale}
            pan={state.settings.portrait.pan}
            photoStyle={uiState.portrait.style}
            photoUrl={uiState.portrait.photoUrl}
            scale={state.settings.portrait.scale}
          />

          {/* Landscape Preview */}
          <PreviewPanel
            frameSrc={uiState.frameSrc}
            isLoading={uiState.landscape.isLoading}
            label="Landscape"
            meta={uiState.landscape.meta}
            navDisabled={uiState.landscape.navDisabled}
            onNext={() => cyclePreview("landscape", 1)}
            onPanChange={setLandscapePan}
            onPrev={() => cyclePreview("landscape", -1)}
            onScaleChange={setLandscapeScale}
            pan={state.settings.landscape.pan}
            photoStyle={uiState.landscape.style}
            photoUrl={uiState.landscape.photoUrl}
            scale={state.settings.landscape.scale}
          />
        </div>
      </main>
    </div>
  );
}

function PreviewPanel({
  frameSrc,
  isLoading,
  label,
  meta,
  navDisabled,
  pan,
  onNext,
  onPanChange,
  onPrev,
  onScaleChange,
  photoStyle,
  photoUrl,
  scale,
}: {
  frameSrc?: string;
  isLoading: boolean;
  label: string;
  meta: string;
  navDisabled: boolean;
  pan: { x: number; y: number };
  onNext: () => void;
  onPanChange: (v: { x: number; y: number }) => void;
  onPrev: () => void;
  onScaleChange: (v: number) => void;
  photoStyle?: CSSProperties;
  photoUrl?: string;
  scale: number;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<{
    pointerId: number;
    mode: "pan" | "scale";
    signX: number;
    signY: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    startScale: number;
  } | null>(null);

  const canInteract = Boolean(frameSrc && photoUrl && photoStyle) && !isLoading;

  const clampPan = (value: number) => Math.max(-2, Math.min(2, value));
  const clampScale = (value: number) => Math.max(0.1, Math.min(5, value));
  const pinch = usePinch(
    scale,
    (v) => onScaleChange(clampScale(v)),
    canInteract,
  );

  const onPanPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canInteract) return;
    event.preventDefault();

    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    interactionRef.current = {
      mode: "pan",
      pointerId: event.pointerId,
      signX: 0,
      signY: 0,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      startScale: scale,
    };
  };

  const onScaleHandlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    signX: number,
    signY: number,
  ) => {
    if (!canInteract) return;

    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    interactionRef.current = {
      mode: "scale",
      pointerId: event.pointerId,
      signX,
      signY,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      startScale: scale,
    };
  };

  const onTransformPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const active = interactionRef.current;
    const frameEl = frameRef.current;

    if (!active || active.pointerId !== event.pointerId || !frameEl) return;

    event.preventDefault();

    const dx = event.clientX - active.startClientX;
    const dy = event.clientY - active.startClientY;
    const frameRect = frameEl.getBoundingClientRect();

    if (active.mode === "pan") {
      onPanChange({
        x: clampPan(active.startPanX + dx / frameRect.width),
        y: clampPan(active.startPanY + dy / frameRect.height),
      });
      return;
    }

    const reference = Math.max(1, Math.min(frameRect.width, frameRect.height));
    const normalizedDelta = (dx * active.signX + dy * active.signY) / reference;
    onScaleChange(clampScale(active.startScale * (1 + normalizedDelta)));
  };

  const onTransformPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = interactionRef.current;
    if (!active || active.pointerId !== event.pointerId) return;

    const target = event.currentTarget;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }

    interactionRef.current = null;
  };

  const onTransformLostPointerCapture = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const active = interactionRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    interactionRef.current = null;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Navigation arrows + label */}
      <div className="flex items-center justify-center gap-3">
        <Button
          className="size-9 sm:size-8"
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
          className="size-9 sm:size-8"
          disabled={navDisabled}
          onClick={onNext}
          size="icon"
          variant="outline"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Preview Container */}
      <div className="relative flex touch-none items-center justify-center overflow-hidden rounded-lg border bg-card p-3 shadow-sm">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/80 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}

        {frameSrc ? (
          <div
            className="pointer-events-none relative max-h-[50vh] max-w-full select-none lg:max-h-[60vh]"
            ref={frameRef}
          >
            <img
              alt="Frame"
              className="block max-h-[50vh] w-auto max-w-full object-contain lg:max-h-[60vh]"
              draggable={false}
              src={frameSrc}
            />
            {photoUrl && photoStyle && (
              <>
                <img
                  alt="Preview"
                  draggable={false}
                  src={photoUrl}
                  style={photoStyle}
                />
                <div
                  className={cn(
                    "pointer-events-auto absolute touch-none border-2 border-primary shadow-sm",
                    canInteract && "cursor-grab active:cursor-grabbing",
                  )}
                  onLostPointerCapture={onTransformLostPointerCapture}
                  onPointerCancel={onTransformPointerEnd}
                  onPointerDown={onPanPointerDown}
                  onPointerMove={onTransformPointerMove}
                  onPointerUp={onTransformPointerEnd}
                  onTouchEnd={pinch.onTouchEnd}
                  onTouchMove={pinch.onTouchMove}
                  onTouchStart={pinch.onTouchStart}
                  style={{
                    ...photoStyle,
                    pointerEvents: "auto",
                    zIndex: 20,
                  }}
                >
                  {/* Interactive Handles */}
                  {[
                    {
                      cursor: "cursor-nwse-resize",
                      pos: "-top-2.5 -left-2.5 sm:-top-1.5 sm:-left-1.5",
                      signX: -1,
                      signY: -1,
                    },
                    {
                      cursor: "cursor-nesw-resize",
                      pos: "-top-2.5 -right-2.5 sm:-top-1.5 sm:-right-1.5",
                      signX: 1,
                      signY: -1,
                    },
                    {
                      cursor: "cursor-nesw-resize",
                      pos: "-bottom-2.5 -left-2.5 sm:-bottom-1.5 sm:-left-1.5",
                      signX: -1,
                      signY: 1,
                    },
                    {
                      cursor: "cursor-nwse-resize",
                      pos: "-bottom-2.5 -right-2.5 sm:-bottom-1.5 sm:-right-1.5",
                      signX: 1,
                      signY: 1,
                    },
                  ].map(({ cursor, pos, signX, signY }) => (
                    <div
                      className={cn(
                        "pointer-events-auto absolute size-5 touch-none rounded-full border border-primary bg-background shadow-sm transition-transform hover:scale-125 sm:size-3.5",
                        pos,
                        cursor,
                      )}
                      key={pos}
                      onLostPointerCapture={onTransformLostPointerCapture}
                      onPointerCancel={onTransformPointerEnd}
                      onPointerDown={(event) =>
                        onScaleHandlePointerDown(event, signX, signY)
                      }
                      onPointerMove={onTransformPointerMove}
                      onPointerUp={onTransformPointerEnd}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex aspect-square w-full max-w-75 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <span className="text-sm">Upload a frame</span>
          </div>
        )}
      </div>

      <div className="text-center text-muted-foreground text-xs">
        Drag photo to move • Pinch or drag corners to resize
      </div>
    </div>
  );
}
