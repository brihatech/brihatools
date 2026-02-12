import {
  Bold,
  Download,
  Italic,
  Minus,
  Plus,
  PlusCircleIcon,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { useDrag } from "./hooks/use-drag";
import {
  type SelectedTextId,
  type TextStyleFlags,
  usePosterBuilder,
} from "./hooks/use-poster-builder";
import { useTransliteration } from "./hooks/use-transliteration";

export function PosterPage() {
  const pb = usePosterBuilder();
  const translit = useTransliteration();

  const dragCallbacks = useMemo(
    () => ({
      clampDragDelta: pb.clampDragDelta,
      onDragEnd: pb.saveActiveTextOffsets,
      onNameDrag: pb.onNameDrag,
      onPhotoDrag: pb.onPhotoDrag,
      onRoleDrag: pb.onRoleDrag,
    }),
    [
      pb.clampDragDelta,
      pb.saveActiveTextOffsets,
      pb.onNameDrag,
      pb.onPhotoDrag,
      pb.onRoleDrag,
    ],
  );

  const drag = useDrag(dragCallbacks);

  const handleNameInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      pb.setFullName(e.target.value);
      translit.scheduleSuggestions("name", pb.fullNameInputRef.current);
    },
    [pb, translit],
  );

  const handleRoleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      const input = e.target as HTMLInputElement;
      pb.activeRoleInputRef.current = input;
      pb.setActiveRoleIndex(index);
      pb.setDesignationLines((prev) =>
        prev.map((line, i) => (i === index ? input.value : line)),
      );
      translit.scheduleSuggestions("role", input);
    },
    [pb, translit],
  );

  const handleNameKeydown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const isArrowDown = event.key === "ArrowDown";
      const isArrowUp = event.key === "ArrowUp";
      const isSpace = event.key === " ";
      const shouldApply =
        event.key === "Enter" || event.key === "Tab" || isSpace;

      if (isArrowDown || isArrowUp) {
        if (
          !translit.nameSuggestionsVisible &&
          translit.nameSuggestions.length > 0
        ) {
          translit.setNameSuggestionsVisible(true);
        }
        if (translit.nameSuggestions.length > 0) {
          event.preventDefault();
          const delta = isArrowDown ? 1 : -1;
          const current = translit.nameSuggestionIndex;
          const next = current === -1 ? 0 : current + delta;
          translit.setSuggestionIndex("name", next);
        }
        return;
      }

      if (!shouldApply || !translit.nameSuggestionsVisible) return;
      const idx = translit.nameSuggestionIndex;
      const picked =
        idx >= 0 ? translit.nameSuggestions[idx] : translit.nameSuggestions[0];
      if (!picked) return;
      event.preventDefault();
      const newVal = translit.applySuggestion(
        "name",
        picked,
        pb.fullNameInputRef.current,
        isSpace ? " " : "",
      );
      if (newVal !== null) pb.setFullName(newVal);
    },
    [pb, translit],
  );

  const handleRoleKeydown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      pb.activeRoleInputRef.current = event.target as HTMLInputElement;
      const isArrowDown = event.key === "ArrowDown";
      const isArrowUp = event.key === "ArrowUp";
      const isEnter = event.key === "Enter";
      const isSpace = event.key === " ";
      const shouldApply =
        event.key === "Enter" || event.key === "Tab" || isSpace;

      if (isArrowDown || isArrowUp) {
        if (
          !translit.roleSuggestionsVisible &&
          translit.roleSuggestions.length > 0
        ) {
          translit.setRoleSuggestionsVisible(true);
        }
        if (translit.roleSuggestions.length > 0) {
          event.preventDefault();
          const delta = isArrowDown ? 1 : -1;
          const current = translit.roleSuggestionIndex;
          const next = current === -1 ? 0 : current + delta;
          translit.setSuggestionIndex("role", next);
        }
        return;
      }

      if (!shouldApply) return;
      if (isEnter && !translit.roleSuggestionsVisible) return;
      if (!translit.roleSuggestionsVisible) return;
      const idx = translit.roleSuggestionIndex;
      const picked =
        idx >= 0 ? translit.roleSuggestions[idx] : translit.roleSuggestions[0];
      if (!picked) return;
      event.preventDefault();
      const newVal = translit.applySuggestion(
        "role",
        picked,
        pb.activeRoleInputRef.current,
        isSpace ? " " : "",
      );
      if (newVal !== null) {
        const roleIdx = pb.activeRoleIndex;
        pb.setDesignationLines((prev) =>
          prev.map((line, i) => (i === roleIdx ? newVal : line)),
        );
      }
    },
    [pb, translit],
  );

  const pickNameSuggestion = useCallback(
    (value: string) => {
      const newVal = translit.applySuggestion(
        "name",
        value,
        pb.fullNameInputRef.current,
      );
      if (newVal !== null) pb.setFullName(newVal);
    },
    [pb, translit],
  );

  const pickRoleSuggestion = useCallback(
    (value: string) => {
      const newVal = translit.applySuggestion(
        "role",
        value,
        pb.activeRoleInputRef.current,
      );
      if (newVal !== null) {
        const roleIdx = pb.activeRoleIndex;
        pb.setDesignationLines((prev) =>
          prev.map((line, i) => (i === roleIdx ? newVal : line)),
        );
      }
    },
    [pb, translit],
  );

  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-4 lg:grid lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)_minmax(220px,360px)] lg:items-start lg:gap-6">
        {/* Left Panel - Controls */}
        <div className="order-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6 lg:order-1">
          <div className="flex flex-col gap-4 lg:gap-6">
            {/* Header with Reset */}
            <div className="hidden items-center justify-between lg:flex">
              <h2 className="font-medium text-sm">Controls</h2>
              <Button
                className="h-7 gap-1 px-2 text-muted-foreground text-xs"
                onClick={pb.clearAll}
                size="sm"
                variant="ghost"
              >
                <RotateCcw className="size-3" />
                Reset
              </Button>
            </div>

            {/* Upload Photo */}
            <div>
              <Label className="mb-2 hidden lg:block">Upload Your Photo</Label>
              <input
                accept="image/*"
                className="hidden"
                onChange={pb.onPhotoFileChange}
                ref={pb.photoUploadRef}
                type="file"
              />

              {/* Mobile upload button */}
              {!pb.hasPhoto && (
                <Button
                  className="w-full lg:hidden"
                  onClick={() => pb.photoUploadRef.current?.click()}
                  variant="outline"
                >
                  <Upload className="size-4" />
                  Upload Your Photo
                </Button>
              )}

              {/* Desktop upload area */}
              <div className="group relative mt-2 hidden lg:block">
                <button
                  className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-md border border-border border-dashed bg-muted/50 p-4 text-muted-foreground transition hover:border-primary/50 hover:bg-muted"
                  onClick={() => pb.photoUploadRef.current?.click()}
                  type="button"
                >
                  {pb.hasPhoto ? (
                    <img
                      alt="Upload preview"
                      className="absolute inset-0 h-full w-full object-cover"
                      src={pb.photoSrc}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex size-12 items-center justify-center rounded-full border bg-background">
                        <Plus className="size-5 text-muted-foreground" />
                      </div>
                      <span className="font-semibold text-xs uppercase tracking-widest">
                        Upload Photo
                      </span>
                      <span className="text-muted-foreground text-xs">
                        PNG or JPG
                      </span>
                    </div>
                  )}
                </button>
                {pb.hasPhoto && (
                  <button
                    aria-label="Remove photo"
                    className="absolute top-3 right-3 rounded-full bg-background/90 p-2 text-foreground opacity-0 shadow-sm transition group-hover:opacity-100"
                    onClick={pb.clearPhoto}
                    type="button"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Name + Designation */}
            <div
              className={cn(
                "flex flex-col gap-4 lg:gap-5",
                !pb.hasPhoto && "hidden lg:flex",
              )}
            >
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <Label className="hidden lg:block" htmlFor="fullName">
                  Full Name
                </Label>
                <div className="relative">
                  <Input
                    autoComplete="off"
                    id="fullName"
                    onBlur={translit.hideNameSuggestions}
                    onChange={handleNameInput}
                    onFocus={() => {
                      pb.setSelectedTextId("name");
                      translit.scheduleSuggestions(
                        "name",
                        pb.fullNameInputRef.current,
                      );
                    }}
                    onKeyDown={handleNameKeydown}
                    placeholder="Full Name"
                    ref={pb.fullNameInputRef}
                    type="text"
                    value={pb.fullName}
                  />
                  {translit.nameSuggestionsVisible && (
                    <div
                      className="absolute top-full right-0 left-0 z-20 mt-2 rounded-md border bg-popover p-1 shadow-lg"
                      onMouseDown={(e) => e.preventDefault()}
                      role="listbox"
                    >
                      {translit.nameSuggestions.map((s, idx) => (
                        <button
                          className={cn(
                            "flex w-full items-center rounded-sm px-3 py-2 text-left text-sm hover:bg-accent",
                            idx === translit.nameSuggestionIndex && "bg-accent",
                          )}
                          key={`name-suggestion-${s}`}
                          onClick={() => pickNameSuggestion(s)}
                          onMouseEnter={() =>
                            translit.setSuggestionIndex("name", idx)
                          }
                          type="button"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Designations */}
              <div className="flex flex-col gap-1.5">
                <Label className="hidden lg:block">Designation</Label>
                <div className="flex flex-col gap-3">
                  {pb.designationLines.map((line, index) => (
                    <div
                      className="flex flex-col gap-1.5"
                      key={`designation-${index.toString()}`}
                    >
                      <div className="relative">
                        <Input
                          autoComplete="off"
                          onBlur={translit.hideRoleSuggestions}
                          onChange={(e) => handleRoleInput(e, index)}
                          onFocus={(e) => {
                            pb.activeRoleInputRef.current =
                              e.target as HTMLInputElement;
                            pb.setActiveRoleIndex(index);
                            pb.setSelectedTextId(index);
                            translit.scheduleSuggestions(
                              "role",
                              e.target as HTMLInputElement,
                            );
                          }}
                          onKeyDown={handleRoleKeydown}
                          placeholder={`Designation ${index + 1}`}
                          type="text"
                          value={line}
                        />
                        {translit.roleSuggestionsVisible &&
                          pb.activeRoleIndex === index && (
                            <div
                              className="absolute top-full right-0 left-0 z-20 mt-2 rounded-md border bg-popover p-1 shadow-lg"
                              onMouseDown={(e) => e.preventDefault()}
                              role="listbox"
                            >
                              {translit.roleSuggestions.map((s, idx) => (
                                <button
                                  className={cn(
                                    "flex w-full items-center rounded-sm px-3 py-2 text-left text-sm hover:bg-accent",
                                    idx === translit.roleSuggestionIndex &&
                                      "bg-accent",
                                  )}
                                  key={`role-suggestion-${s}`}
                                  onClick={() => pickRoleSuggestion(s)}
                                  onMouseEnter={() =>
                                    translit.setSuggestionIndex("role", idx)
                                  }
                                  type="button"
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                  <Button
                    className="rounded-none p-0 outline-dotted outline-1 outline-primary"
                    disabled={pb.designationLines.length >= pb.maxDesignations}
                    onClick={pb.addDesignation}
                    size="sm"
                    variant="ghost"
                  >
                    <PlusCircleIcon className="size-4" /> Add Designation
                  </Button>
                </div>
              </div>
            </div>

            {/* Export */}
            <div
              className={cn(
                "flex flex-col gap-2",
                !pb.hasPhoto && "hidden lg:flex",
              )}
            >
              <Button
                disabled={pb.exportBusy}
                onClick={pb.exportPoster}
                variant="outline"
              >
                <Download className="size-4" />
                {pb.exportBusy ? "Downloading..." : "Download Image"}
              </Button>
              {pb.exportMessage && (
                <span className="text-muted-foreground text-xs">
                  {pb.exportMessage}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center - Stage + Floating Toolbar */}
        <div className="order-2 flex flex-col items-center gap-2 lg:order-2">
          {/* Floating toolbar */}
          {pb.selectedTextId === "photo" ? (
            <PhotoToolbar onClose={() => pb.setSelectedTextId(null)} pb={pb} />
          ) : (
            <TextToolbar
              onClose={() => pb.setSelectedTextId(null)}
              pb={pb}
              selectedTextId={pb.selectedTextId}
            />
          )}

          <div
            className="relative aspect-square w-full max-w-160 overflow-hidden rounded-md border shadow-lg"
            id="stage"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) pb.setSelectedTextId(null);
            }}
            ref={pb.stageRef}
          >
            <img
              alt="Poster frame"
              className="absolute inset-0 h-full w-full object-contain"
              onPointerDown={() => pb.setSelectedTextId(null)}
              ref={pb.frameImageRef}
              src={pb.activeFrame}
            />

            {pb.hasPhoto && pb.photoSrc && (
              <div
                className={cn(
                  "absolute top-1/2 left-1/2 w-[35%] cursor-grab touch-none select-none",
                  pb.selectedTextId === "photo" && "outline-1 outline-blue-500",
                )}
                onPointerCancel={drag.onPhotoPointerUp}
                onPointerDown={(e) => {
                  drag.onPhotoPointerDown(e);
                }}
                onPointerLeave={drag.onPhotoPointerUp}
                onPointerMove={drag.onPhotoPointerMove}
                onPointerUp={(e) => {
                  drag.onPhotoPointerUp(e);
                  pb.setSelectedTextId("photo");
                }}
                style={{
                  transform: `translate(-50%, -50%) translate(${pb.offsetX}px, ${pb.offsetY}px) scale(${pb.scale})`,
                }}
              >
                <img
                  alt="Uploaded portrait"
                  className="block w-full touch-none select-none"
                  draggable={false}
                  ref={pb.photoImageRef}
                  src={pb.photoSrc}
                />
                {pb.removeBgBusy && (
                  <div
                    className={cn(
                      "photo-processing-wrap",
                      pb.removeBgBusy && "is-active",
                    )}
                  >
                    <div className="photo-processing-overlay" />
                    <div className="photo-processing-sheen" />
                  </div>
                )}
              </div>
            )}

            {pb.activeFrameConfig.hasOverlay && (
              <img
                alt="Frame overlay"
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                src={pb.activeFrameConfig.overlaySrc}
              />
            )}

            <div
              className="pointer-events-none absolute"
              id="frameOverlay"
              ref={pb.frameOverlayRef}
              style={{
                height: "var(--frame-h, 100%)",
                left: "var(--frame-x, 0px)",
                top: "var(--frame-y, 0px)",
                width: "var(--frame-w, 100%)",
              }}
            >
              <div className="absolute inset-0 text-foreground">
                {pb.fullName.trim().length > 0 && (
                  <div
                    className={cn(
                      "pointer-events-auto absolute w-fit cursor-grab touch-none select-none py-1",
                      pb.selectedTextId === "name" &&
                        "outline-1 outline-blue-500",
                    )}
                    id="nameText"
                    onPointerCancel={drag.onNamePointerUp}
                    onPointerDown={drag.onNamePointerDown}
                    onPointerLeave={drag.onNamePointerUp}
                    onPointerMove={drag.onNamePointerMove}
                    onPointerUp={(e) => {
                      drag.onNamePointerUp(e);
                      pb.setSelectedTextId("name");
                    }}
                    ref={pb.nameTextRef}
                    style={cssStringToObject(pb.nameTransformStyle)}
                  >
                    {pb.fullName}
                  </div>
                )}

                {pb.designationLines.map((line, index) =>
                  line.trim().length > 0 ? (
                    <div
                      className={cn(
                        "designation-primary pointer-events-auto absolute w-fit cursor-grab touch-none select-none p-1",
                        pb.selectedTextId === index &&
                          "outline-1 outline-blue-500",
                      )}
                      id={`roleText-${index}`}
                      key={`role-${index.toString()}`}
                      onPointerCancel={drag.onRolePointerUp}
                      onPointerDown={(e) => drag.onRolePointerDown(e, index)}
                      onPointerLeave={drag.onRolePointerUp}
                      onPointerMove={drag.onRolePointerMove}
                      onPointerUp={(e) => {
                        drag.onRolePointerUp(e);
                        pb.setSelectedTextId(index);
                      }}
                      style={cssStringToObject(pb.getRoleTransformStyle(index))}
                    >
                      {line}
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Frames */}
        <div className="order-1 rounded-lg border bg-card p-4 shadow-sm sm:p-6 lg:order-3">
          <h2 className="mb-3 hidden font-medium text-sm lg:block">
            Available Frames
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-3 lg:gap-3 lg:overflow-visible">
            {pb.filteredFrames.map((frame) => (
              <button
                className={cn(
                  "shrink-0 overflow-hidden rounded-md border bg-muted/50 transition hover:-translate-y-0.5 hover:shadow-md",
                  pb.activeFrame === frame.src
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-transparent",
                )}
                key={frame.id}
                onClick={() => pb.setFrameFn(frame.src)}
                type="button"
              >
                <img
                  alt="Frame preview"
                  className="h-24 w-full object-cover"
                  src={frame.thumbSrc || frame.src}
                />
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

const COLOR_SWATCHES = [
  "#000000",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#14b8a6",
  "#84cc16",
  "#007400",
  "#f43f5e",
  "#a855f7",
  "#6366f1",
  "#0ea5e9",
];

type PbReturn = ReturnType<typeof usePosterBuilder>;

function PhotoToolbar({ pb, onClose }: { pb: PbReturn; onClose: () => void }) {
  const scalePercent = Math.round(pb.scale * 100);

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card px-2 py-1.5 shadow-md">
      {/* BG Removal */}
      <Button
        className="h-7 gap-1.5 px-2.5 text-xs"
        disabled={!pb.hasPhoto || pb.removeBgBusy}
        onClick={() => pb.removeBackground(pb.removeBgQuality)}
        size="sm"
        variant="ghost"
      >
        <Sparkles className="size-3.5" />
        {pb.removeBgBusy ? "Removing..." : "BG Removal"}
      </Button>

      <div className="mx-0.5 h-5 w-px bg-border" />

      {/* Change Model */}
      <Button
        className="h-7 gap-1.5 px-2.5 text-xs"
        onClick={() =>
          pb.setRemoveBgQuality(pb.removeBgQuality === "hq" ? "standard" : "hq")
        }
        size="sm"
        variant="ghost"
      >
        <RefreshCw className="size-3.5" />
        {pb.removeBgQuality === "hq" ? "HD Model" : "Switch Model"}
      </Button>

      <div className="mx-0.5 h-5 w-px bg-border" />

      {/* Scale */}
      <Button
        className="size-7"
        onClick={() =>
          pb.setScale(Math.max(0.4, +(pb.scale - 0.05).toFixed(2)))
        }
        size="icon"
        variant="ghost"
      >
        <Minus className="size-3.5" />
      </Button>
      <span className="min-w-9 text-center font-medium text-xs tabular-nums">
        {scalePercent}%
      </span>
      <Button
        className="size-7"
        onClick={() =>
          pb.setScale(Math.min(2.5, +(pb.scale + 0.05).toFixed(2)))
        }
        size="icon"
        variant="ghost"
      >
        <Plus className="size-3.5" />
      </Button>

      <div className="mx-0.5 h-5 w-px bg-border" />

      {/* Close */}
      <Button className="size-7" onClick={onClose} size="icon" variant="ghost">
        <X className="size-3.5" />
      </Button>

      {/* Status message */}
      {pb.removeBgMessage && (
        <span className="ml-1 text-muted-foreground text-xs">
          {pb.removeBgMessage}
        </span>
      )}
    </div>
  );
}

function TextToolbar({
  selectedTextId,
  pb,
  onClose,
}: {
  selectedTextId: SelectedTextId;
  pb: PbReturn;
  onClose: () => void;
}) {
  const [colorOpen, setColorOpen] = useState(false);

  if (selectedTextId === null) return null;

  const isName = selectedTextId === "name";
  const desIdx = typeof selectedTextId === "number" ? selectedTextId : -1;

  const currentScale = isName
    ? pb.nameScaleAdjust
    : (pb.roleScaleAdjusts[desIdx] ?? 1);
  const currentColor = isName
    ? pb.nameColor
    : (pb.designationColors[desIdx] ?? null);
  const defaultColor = isName
    ? pb.activeFrameConfig.nameText.color
    : pb.activeFrameConfig.roleText.color;
  const currentStyle: TextStyleFlags = isName
    ? pb.nameTextStyle
    : (pb.designationTextStyles[desIdx] ?? {
        bold: false,
        italic: false,
      });

  const displayColor = currentColor ?? defaultColor;

  const handleScaleChange = (dir: number) => {
    if (isName) {
      pb.adjustNameScale(dir);
    } else {
      pb.adjustRoleScale(desIdx, dir);
    }
  };

  const handleColorChange = (color: string | null) => {
    if (isName) {
      pb.setNameColor(color);
    } else {
      pb.setDesignationColors((prev) =>
        prev.map((v, i) => (i === desIdx ? color : v)),
      );
    }
  };

  const handleStyleToggle = (key: keyof TextStyleFlags) => {
    if (isName) {
      pb.setNameTextStyle((prev) => ({ ...prev, [key]: !prev[key] }));
    } else {
      pb.setDesignationTextStyles((prev) =>
        prev.map((s, i) => (i === desIdx ? { ...s, [key]: !s[key] } : s)),
      );
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card px-2 py-1.5 shadow-md">
      {/* Color */}
      <Popover onOpenChange={setColorOpen} open={colorOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex size-7 items-center justify-center rounded-md hover:bg-accent"
            title="Text color"
            type="button"
          >
            <span className="flex flex-col items-center gap-0.5">
              <span className="font-bold text-foreground text-xs">A</span>
              <span
                className="h-0.5 w-3.5 rounded-full"
                style={{ backgroundColor: displayColor }}
              />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" side="bottom">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-8 gap-1">
              {COLOR_SWATCHES.map((c) => (
                <button
                  className={cn(
                    "size-6 rounded-full border transition hover:scale-110",
                    displayColor === c
                      ? "ring-2 ring-primary ring-offset-1"
                      : "border-border",
                  )}
                  key={c}
                  onClick={() => {
                    handleColorChange(c);
                    setColorOpen(false);
                  }}
                  style={{ backgroundColor: c }}
                  title={c}
                  type="button"
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border px-2 py-1">
                <span
                  className="block size-5 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: displayColor }}
                />
                <input
                  className="w-0 flex-1 border-none bg-transparent font-mono text-xs outline-none"
                  onChange={(e) => handleColorChange(e.target.value)}
                  type="text"
                  value={displayColor}
                />
                <input
                  className="sr-only"
                  onChange={(e) => handleColorChange(e.target.value)}
                  type="color"
                  value={displayColor}
                />
              </label>
              {currentColor && (
                <Button
                  className="h-7 shrink-0 px-2 text-xs"
                  onClick={() => {
                    handleColorChange(null);
                    setColorOpen(false);
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div className="mx-0.5 h-5 w-px bg-border" />

      {/* Scale */}
      <Button
        className="size-7"
        onClick={() => handleScaleChange(-1)}
        size="icon"
        variant="ghost"
      >
        <Minus className="size-3.5" />
      </Button>
      <span className="min-w-9 text-center font-medium text-xs tabular-nums">
        {Math.round(currentScale * 100)}%
      </span>
      <Button
        className="size-7"
        onClick={() => handleScaleChange(1)}
        size="icon"
        variant="ghost"
      >
        <Plus className="size-3.5" />
      </Button>

      <div className="mx-0.5 h-5 w-px bg-border" />

      {/* Bold / Italic / Underline */}
      <Button
        className={cn("size-7", currentStyle.bold && "bg-accent")}
        onClick={() => handleStyleToggle("bold")}
        size="icon"
        variant="ghost"
      >
        <Bold className="size-3.5" />
      </Button>
      <Button
        className={cn("size-7", currentStyle.italic && "bg-accent")}
        onClick={() => handleStyleToggle("italic")}
        size="icon"
        variant="ghost"
      >
        <Italic className="size-3.5" />
      </Button>

      <div className="mx-0.5 h-5 w-px bg-border" />

      {/* Close */}
      <Button className="size-7" onClick={onClose} size="icon" variant="ghost">
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

function cssStringToObject(cssString: string): React.CSSProperties {
  const style: Record<string, string> = {};
  for (const declaration of cssString.split(";")) {
    const trimmed = declaration.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const prop = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    const camelProp = prop.replace(/-([a-z])/g, (_, letter: string) =>
      letter.toUpperCase(),
    );
    style[camelProp] = value;
  }
  return style as React.CSSProperties;
}
