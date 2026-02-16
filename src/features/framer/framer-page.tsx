import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImagePlus,
  Images,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { type CSSProperties, useEffect, useRef } from "react";

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
    clearAll,
    clearFrame,
    clearPhotos,
    cyclePreview,
    downloadStatus,
    downloadZip,
    frameFile,
    frameUrl,
    onFrameChange,
    onPhotosChange,
    photoFiles,
    photoStatus,
    setExportQuality,
    setLandscapePan,
    setLandscapeScale,
    setPortraitPan,
    setPortraitScale,
    setSquarePan,
    setSquareScale,
    state,
    uiState,
  } = usePhotoFramer();

  const previewRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to preview when both frame and photos are loaded
  const hasFrame = Boolean(uiState.frameSrc);
  const hasPhotos =
    uiState.portrait.count > 0 ||
    uiState.landscape.count > 0 ||
    uiState.square.count > 0;
  const prevReadyRef = useRef(false);

  useEffect(() => {
    const isReady = hasFrame && hasPhotos;
    if (isReady && !prevReadyRef.current) {
      // Small delay to let the panels render
      setTimeout(() => {
        previewRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
    prevReadyRef.current = isReady;
  }, [hasFrame, hasPhotos]);

  const hasAnything = frameFile || photoFiles.length > 0;

  const activePanels: Array<{
    key: string;
    label: string;
    state: (typeof uiState)["portrait"];
    scale: number;
    pan: { x: number; y: number };
    onScaleChange: (v: number) => void;
    onPanChange: (v: { x: number; y: number }) => void;
    maxScale?: number;
  }> = [];

  if (uiState.portrait.count > 0) {
    activePanels.push({
      key: "portrait",
      label: "Portrait",
      state: uiState.portrait,
      scale: state.settings.portrait.scale,
      pan: state.settings.portrait.pan,
      onScaleChange: setPortraitScale,
      onPanChange: setPortraitPan,
      maxScale: uiState.portrait.maxScale,
    });
  }
  if (uiState.landscape.count > 0) {
    activePanels.push({
      key: "landscape",
      label: "Landscape",
      state: uiState.landscape,
      scale: state.settings.landscape.scale,
      pan: state.settings.landscape.pan,
      onScaleChange: setLandscapeScale,
      onPanChange: setLandscapePan,
      maxScale: uiState.landscape.maxScale,
    });
  }
  if (uiState.square.count > 0) {
    activePanels.push({
      key: "square",
      label: "Square",
      state: uiState.square,
      scale: state.settings.square.scale,
      pan: state.settings.square.pan,
      onScaleChange: setSquareScale,
      onPanChange: setSquarePan,
      maxScale: uiState.square.maxScale,
    });
  }

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
            {frameFile && frameUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5">
                <img
                  alt="Frame preview"
                  className="size-12 rounded-md border border-border object-cover shadow-sm"
                  src={frameUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground text-xs">
                    {frameFile.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {(frameFile.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <Button
                  className="size-7 shrink-0"
                  onClick={clearFrame}
                  size="icon"
                  variant="ghost"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="group relative">
                <input
                  accept="image/*"
                  className="hidden"
                  id="frameInput"
                  onChange={onFrameChange}
                  type="file"
                />
                <label
                  className="flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-border border-dashed bg-muted/30 px-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
                  htmlFor="frameInput"
                >
                  <div className="rounded-full bg-background p-1.5 shadow-sm ring-1 ring-border transition-colors group-hover:ring-primary/20">
                    <ImagePlus className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  <span className="text-center font-medium text-muted-foreground text-xs transition-colors group-hover:text-foreground">
                    Click to select frame
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Photos Upload */}
          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              Source Photos
            </Label>
            {photoFiles.length > 0 ? (
              <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground text-xs">
                    {photoFiles.length} photo
                    {photoFiles.length !== 1 ? "s" : ""} selected
                  </p>
                  <Button
                    className="size-7 shrink-0"
                    onClick={clearPhotos}
                    size="icon"
                    variant="ghost"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <div className="flex gap-1.5 overflow-hidden">
                  {photoFiles.slice(0, 4).map((file) => (
                    <PhotoThumb file={file} key={file.name + file.size} />
                  ))}
                  {photoFiles.length > 4 && (
                    <div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted font-medium text-[10px] text-muted-foreground">
                      +{photoFiles.length - 4}
                    </div>
                  )}
                </div>
                {photoStatus && (
                  <p className="mt-1.5 font-medium text-[10px] text-primary">
                    {photoStatus}
                  </p>
                )}
              </div>
            ) : (
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
                  className="flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-border border-dashed bg-muted/30 px-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
                  htmlFor="photoInput"
                >
                  <div className="rounded-full bg-background p-1.5 shadow-sm ring-1 ring-border transition-colors group-hover:ring-primary/20">
                    <Images className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  <span className="text-center font-medium text-muted-foreground text-xs transition-colors group-hover:text-foreground">
                    Click to select photos
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Clear All — only shown when there's something to clear */}
          {hasAnything && (
            <Button
              className="w-full"
              onClick={clearAll}
              size="sm"
              variant="outline"
            >
              <RotateCcw className="size-3.5" />
              Clear All
            </Button>
          )}

          {/* Export Quality — desktop only (also in mobile footer) */}
          <div className="hidden space-y-2 lg:block">
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

        {/* Export Button — desktop only */}
        <div className="mt-4 hidden space-y-3 border-t pt-4 lg:block">
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
      <main className="relative flex-1 overflow-auto">
        <div className="p-4 pb-24 sm:p-6 sm:pb-28 lg:pb-6" ref={previewRef}>
          {activePanels.length > 0 ? (
            <div
              className={cn(
                "grid h-full gap-6",
                activePanels.length === 1
                  ? "mx-auto max-w-3xl lg:grid-cols-1"
                  : activePanels.length === 2
                    ? "lg:grid-cols-2"
                    : "lg:grid-cols-2 xl:grid-cols-3",
              )}
            >
              {activePanels.map((panel) => (
                <PreviewPanel
                  frameSrc={uiState.frameSrc}
                  isLoading={panel.state.isLoading}
                  key={panel.key}
                  label={panel.label}
                  meta={panel.state.meta}
                  navDisabled={panel.state.navDisabled}
                  onNext={() =>
                    cyclePreview(
                      panel.key as "portrait" | "landscape" | "square",
                      1,
                    )
                  }
                  onPanChange={panel.onPanChange}
                  onPrev={() =>
                    cyclePreview(
                      panel.key as "portrait" | "landscape" | "square",
                      -1,
                    )
                  }
                  onScaleChange={panel.onScaleChange}
                  pan={panel.pan}
                  photoStyle={panel.state.style}
                  photoUrl={panel.state.photoUrl}
                  scale={panel.scale}
                  maxScale={panel.maxScale}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="rounded-full bg-muted p-4">
                <Images className="size-8 text-muted-foreground/60" />
              </div>
              <p className="font-medium text-sm">No previews to show</p>
              <p className="max-w-56 text-center text-xs">
                Upload a frame and photos to see previews for each orientation
              </p>
            </div>
          )}
        </div>

        {/* Mobile sticky footer — Export Quality + Export Button */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t bg-card/90 px-4 py-3 shadow-lg backdrop-blur-md lg:hidden">
          <div className="flex-1">
            <Select
              onValueChange={(v) => setExportQuality(v as ExportQuality)}
              value={state.exportQuality}
            >
              <SelectTrigger className="h-10">
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
            className="flex-1"
            disabled={uiState.downloadDisabled}
            onClick={downloadZip}
            size="lg"
          >
            <Download className="size-4" />
            {downloadStatus || "Export"}
          </Button>
        </div>
      </main>
    </div>
  );
}

function PhotoThumb({ file }: { file: File }) {
  const urlRef = useRef<string | null>(null);
  if (!urlRef.current) {
    urlRef.current = URL.createObjectURL(file);
  }

  useEffect(() => {
    const url = urlRef.current;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  return (
    <img
      alt={file.name}
      className="size-10 rounded-md border border-border object-cover shadow-sm"
      src={urlRef.current ?? ""}
    />
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
  maxScale,
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
  maxScale?: number;
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
  const clampScale = (value: number) => {
    const max = maxScale ? Math.min(5, maxScale) : 5;
    return Math.max(0.1, Math.min(max, value));
  };
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
        x: 0,
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
    <div className="fade-in flex animate-in flex-col gap-3 duration-300">
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
