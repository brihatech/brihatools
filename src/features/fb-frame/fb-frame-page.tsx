import {
  Download,
  ImagePlus,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { usePinch } from "@/hooks/use-pinch";
import { cn } from "@/lib/utils";

import {
  type FrameInfo,
  MAX_SCALE,
  MIN_SCALE,
  useFbFrame,
} from "./hooks/use-fb-frame";

export function FbFramePage() {
  const fb = useFbFrame();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const hadPhotoRef = useRef(false);

  const pinch = usePinch(fb.scale, fb.setScale, fb.hasPhoto);

  const interactionRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const onPanPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!fb.hasPhoto) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    interactionRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: fb.pan.x,
      startPanY: fb.pan.y,
    };
  };

  const onPanPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = interactionRef.current;
    if (!active || active.pointerId !== event.pointerId) return;

    event.preventDefault();
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();

    const dx = (event.clientX - active.startClientX) / rect.width;
    const dy = (event.clientY - active.startClientY) / rect.height;

    fb.setPan({
      x: Math.max(-1, Math.min(1, active.startPanX + dx)),
      y: Math.max(-1, Math.min(1, active.startPanY + dy)),
    });
  };

  const onPanPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = interactionRef.current;
    if (!active || active.pointerId !== event.pointerId) return;

    const target = event.currentTarget;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    interactionRef.current = null;
  };

  useEffect(() => {
    const hadPhoto = hadPhotoRef.current;
    hadPhotoRef.current = fb.hasPhoto;

    if (hadPhoto || !fb.hasPhoto) return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    window.setTimeout(() => {
      previewScrollRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }, [fb.hasPhoto]);

  const getPhotoStyle = (): React.CSSProperties | undefined => {
    if (!fb.selectedFrame || !fb.photoUrl) return undefined;

    const frameAspect = fb.selectedFrame.aspectRatio;
    const photoAspect = fb.photoNaturalWidth / fb.photoNaturalHeight;

    let widthPercent: number;
    let heightPercent: number;

    if (photoAspect > frameAspect) {
      heightPercent = 100;
      widthPercent = (photoAspect / frameAspect) * 100;
    } else {
      widthPercent = 100;
      heightPercent = (frameAspect / photoAspect) * 100;
    }

    widthPercent *= fb.scale;
    heightPercent *= fb.scale;

    const left = 50 + fb.pan.x * 50;
    const top = 50 + fb.pan.y * 50;

    return {
      position: "absolute",
      width: `${widthPercent}%`,
      height: `${heightPercent}%`,
      left: `${left}%`,
      top: `${top}%`,
      transform: "translate(-50%, -50%)",
      objectFit: "cover",
      pointerEvents: "none",
    };
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
      {/* Sidebar */}
      <aside className="flex shrink-0 flex-col border-b bg-card p-4 sm:p-6 lg:w-72 lg:border-r lg:border-b-0">
        <h1 className="mb-1 font-semibold text-lg tracking-tight">
          FB Profile Frame
        </h1>
        <p className="mb-5 text-muted-foreground text-xs">
          Add a frame overlay to your profile picture
        </p>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
          {/* Photo Upload */}
          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              Your Photo
            </Label>
            <input
              accept="image/*"
              className="hidden"
              id="fbPhotoInput"
              onChange={fb.onPhotoChange}
              ref={photoInputRef}
              type="file"
            />
            {fb.photoFile && fb.photoUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5">
                <img
                  alt="Preview thumbnail"
                  className="size-12 rounded-md border border-border object-cover shadow-sm"
                  src={fb.photoUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground text-xs">
                    {fb.photoFile.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {(fb.photoFile.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <Button
                  aria-label="Remove photo"
                  className="size-7 shrink-0"
                  onClick={fb.clearPhoto}
                  size="icon"
                  variant="ghost"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="group relative">
                <label
                  className="flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-border border-dashed bg-muted/30 px-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
                  htmlFor="fbPhotoInput"
                >
                  <div className="rounded-full bg-background p-1.5 shadow-sm ring-1 ring-border transition-colors group-hover:ring-primary/20">
                    <ImagePlus className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  <span className="text-center font-medium text-muted-foreground text-xs transition-colors group-hover:text-foreground">
                    Click to select photo
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Background Removal */}
          {fb.hasPhoto && (
            <div className="hidden space-y-2 lg:block">
              <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Background Removal
              </Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border p-2">
                  <span className="text-sm">Quality</span>
                  <div className="flex items-center gap-1 rounded-md bg-muted/50 p-1">
                    <button
                      className={cn(
                        "rounded px-2 py-1 text-xs transition-colors",
                        fb.removeBgQuality === "standard"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => fb.setRemoveBgQuality("standard")}
                      type="button"
                    >
                      Standard
                    </button>
                    <button
                      className={cn(
                        "rounded px-2 py-1 text-xs transition-colors",
                        fb.removeBgQuality === "hq"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => fb.setRemoveBgQuality("hq")}
                      type="button"
                    >
                      HD
                    </button>
                  </div>
                </div>
                <Button
                  className="w-full gap-2"
                  disabled={fb.removeBgBusy}
                  onClick={fb.removeBackground}
                  size="sm"
                  variant="secondary"
                >
                  {fb.removeBgBusy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {fb.removeBgBusy ? "Processing..." : "Remove Background"}
                </Button>
              </div>
            </div>
          )}

          {/* Frame Selection */}
          <div className="space-y-2">
            <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              Select Frame
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {fb.frames.map((frame) => (
                <FrameThumb
                  frame={frame}
                  isSelected={fb.selectedFrame?.id === frame.id}
                  key={frame.id}
                  onSelect={() => fb.selectFrame(frame)}
                />
              ))}
            </div>
          </div>

          {/* Scale Control - Desktop */}
          {fb.hasPhoto && (
            <div className="hidden space-y-2 lg:block">
              <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Photo Scale
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  aria-label="Zoom out"
                  className="size-8 shrink-0"
                  onClick={() => fb.setScale(fb.scale - 0.1)}
                  size="icon"
                  variant="outline"
                >
                  <ZoomOut className="size-3.5" />
                </Button>
                <Slider
                  className="flex-1"
                  max={MAX_SCALE}
                  min={MIN_SCALE}
                  onValueChange={([v = 1]) => fb.setScale(v ?? 1)}
                  step={0.01}
                  value={[fb.scale]}
                />
                <Button
                  aria-label="Zoom in"
                  className="size-8 shrink-0"
                  onClick={() => fb.setScale(fb.scale + 0.1)}
                  size="icon"
                  variant="outline"
                >
                  <ZoomIn className="size-3.5" />
                </Button>
              </div>
              <p className="text-center text-muted-foreground text-xs">
                {Math.round(fb.scale * 100)}%
              </p>
            </div>
          )}

          {/* Reset Button */}
          {fb.hasPhoto && (
            <Button
              className="w-full"
              onClick={fb.resetTransform}
              size="sm"
              variant="outline"
            >
              <RotateCcw className="size-3.5" />
              Reset Position
            </Button>
          )}
        </div>

        {/* Export Button - Desktop */}
        <div className="mt-4 hidden space-y-3 border-t pt-4 lg:block">
          <Button
            className="w-full"
            disabled={!fb.canExport}
            onClick={fb.exportImage}
            size="lg"
          >
            {fb.isExporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {fb.isExporting ? "Downloading..." : "Download Photo"}
          </Button>
        </div>
      </aside>

      {/* Preview Area */}
      <main className="relative flex-1 overflow-auto">
        <div
          className="flex min-h-full flex-col items-center justify-center p-4 pb-24 sm:p-6 sm:pb-28 lg:pb-6"
          ref={previewScrollRef}
        >
          {fb.selectedFrame ? (
            <div className="flex w-full max-w-lg flex-col items-center gap-4">
              {/* Preview Container */}
              <div
                className={cn(
                  "relative w-full overflow-hidden rounded-lg border bg-card shadow-lg",
                  fb.hasPhoto && "cursor-grab active:cursor-grabbing",
                )}
                onLostPointerCapture={onPanPointerEnd}
                onPointerCancel={onPanPointerEnd}
                onPointerDown={onPanPointerDown}
                onPointerMove={onPanPointerMove}
                onPointerUp={onPanPointerEnd}
                onTouchEnd={pinch.onTouchEnd}
                onTouchMove={pinch.onTouchMove}
                onTouchStart={pinch.onTouchStart}
                style={{
                  aspectRatio: fb.selectedFrame.aspectRatio,
                  touchAction: "none",
                }}
              >
                {/* Photo Layer */}
                {fb.photoUrl && (
                  <img
                    alt="User upload"
                    className="select-none"
                    draggable={false}
                    ref={fb.photoImageRef}
                    src={fb.photoUrl}
                    style={getPhotoStyle()}
                  />
                )}

                {/* Frame Overlay */}
                <img
                  alt="Frame overlay"
                  className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
                  draggable={false}
                  ref={fb.frameImageRef}
                  src={fb.selectedFrame.src}
                />

                {/* Empty State */}
                {!fb.photoUrl && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/50 text-muted-foreground">
                    <ImagePlus className="size-12 opacity-40" />
                    <p className="font-medium text-sm">Upload your photo</p>
                    <Button
                      onClick={() => photoInputRef.current?.click()}
                      size="sm"
                      variant="outline"
                    >
                      Select Photo
                    </Button>
                  </div>
                )}
              </div>

              {/* Instructions */}
              {fb.hasPhoto && (
                <p className="text-center text-muted-foreground text-xs">
                  Drag to move • Pinch or use slider to zoom
                </p>
              )}

              {/* Mobile Scale Control */}
              {fb.hasPhoto && (
                <div className="flex w-full items-center gap-3 lg:hidden">
                  <Button
                    aria-label="Zoom out"
                    className="size-10 shrink-0"
                    onClick={() => fb.setScale(fb.scale - 0.1)}
                    size="icon"
                    variant="outline"
                  >
                    <ZoomOut className="size-4" />
                  </Button>
                  <Slider
                    className="flex-1"
                    max={MAX_SCALE}
                    min={MIN_SCALE}
                    onValueChange={([v]) => fb.setScale(v)}
                    step={0.01}
                    value={[fb.scale]}
                  />
                  <Button
                    aria-label="Zoom in"
                    className="size-10 shrink-0"
                    onClick={() => fb.setScale(fb.scale + 0.1)}
                    size="icon"
                    variant="outline"
                  >
                    <ZoomIn className="size-4" />
                  </Button>
                </div>
              )}

              {/* Mobile Background Removal Control */}
              {fb.hasPhoto && (
                <div className="flex w-full items-center gap-2 lg:hidden">
                  <div className="flex shrink-0 items-center gap-1 rounded-md bg-muted/50 p-1">
                    <button
                      className={cn(
                        "rounded px-2 py-1.5 text-xs transition-colors",
                        fb.removeBgQuality === "standard"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => fb.setRemoveBgQuality("standard")}
                      type="button"
                    >
                      Std
                    </button>
                    <button
                      className={cn(
                        "rounded px-2 py-1.5 text-xs transition-colors",
                        fb.removeBgQuality === "hq"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => fb.setRemoveBgQuality("hq")}
                      type="button"
                    >
                      HD
                    </button>
                  </div>
                  <Button
                    className="flex-1 gap-2"
                    disabled={fb.removeBgBusy}
                    onClick={fb.removeBackground}
                    size="default"
                    variant="secondary"
                  >
                    {fb.removeBgBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {fb.removeBgBusy ? "Processing..." : "Remove BG"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
              <p className="text-sm">Loading frames...</p>
            </div>
          )}
        </div>

        {/* Mobile sticky footer - Export Button */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t bg-card/90 px-4 py-3 shadow-lg backdrop-blur-md lg:hidden">
          <Button
            className="flex-1"
            disabled={!fb.canExport}
            onClick={fb.exportImage}
            size="lg"
          >
            {fb.isExporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {fb.isExporting ? "Exporting..." : "Export JPG"}
          </Button>
        </div>
      </main>
    </div>
  );
}

function FrameThumb({
  frame,
  isSelected,
  onSelect,
}: {
  frame: FrameInfo;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={cn(
        "overflow-hidden rounded-md border bg-muted/50 transition hover:-translate-y-0.5 hover:shadow-md",
        isSelected
          ? "border-primary ring-2 ring-primary/30"
          : "border-transparent",
      )}
      onClick={onSelect}
      type="button"
    >
      <img
        alt={frame.name}
        className="aspect-square w-full object-cover"
        src={frame.src}
      />
    </button>
  );
}
