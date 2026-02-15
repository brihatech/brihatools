import { getAlpine, startAlpine } from "@/alpine";
import { enforcePosterOnlyHosts } from "@/hostRedirect";

import {
  type BackgroundRemovalQuality,
  removeBackground as removeBackgroundImage,
} from "./background";
import { computeContainedRect, generatePoster } from "./canvas";
import {
  getDefaultPosterCategoryForHostname,
  type PosterCategory,
  type PosterRealCategory,
} from "./category";
import { DEFAULT_FRAME_SRC, FRAMES } from "./frames";
import { extractLastToken, getSuggestions, splitByCursor } from "./suggestions";

const TRANSLITERATE_DEBOUNCE_MS = 180;
const TEXT_SCALE_MIN = 0.8;
const TEXT_SCALE_MAX = 1.2;
const TEXT_SCALE_STEP = 0.05;
const MAX_DESIGNATIONS = 5;

type DesignationStyle = {
  fontSizePx: number;
  color: string;
  fontWeight: string;
};

const DEFAULT_ROLE_STYLE_SOURCE =
  FRAMES.find((frame) => frame.src === DEFAULT_FRAME_SRC) ?? FRAMES[0];

const DEFAULT_ROLE_STYLE: DesignationStyle = DEFAULT_ROLE_STYLE_SOURCE
  ? {
      fontSizePx: DEFAULT_ROLE_STYLE_SOURCE.roleText.fontSizePx,
      color: DEFAULT_ROLE_STYLE_SOURCE.roleText.color,
      fontWeight: DEFAULT_ROLE_STYLE_SOURCE.roleText.fontWeight,
    }
  : {
      fontSizePx: 32,
      color: "#0f172a",
      fontWeight: "600",
    };

enforcePosterOnlyHosts();

const Alpine = getAlpine();

Alpine.data("posterBuilder", () => {
  let currentPhotoObjectUrl: string | null = null;
  let removeBgRunId = 0;

  // Drag state (not reactive)
  let dragTarget:
    | { type: "photo" }
    | { type: "name" }
    | { type: "role"; index: number }
    | null = null;
  let startX = 0;
  let startY = 0;

  // Suggestion state (not fully reactive)
  let nameDebounceHandle: number | null = null;
  let roleDebounceHandle: number | null = null;
  let nameLatestRequestId = 0;
  let roleLatestRequestId = 0;
  let suppressNextNameSuggestions = false;
  let suppressNextRoleSuggestions = false;

  return {
    frames: FRAMES,
    activeFrame: DEFAULT_FRAME_SRC,
    selectedCategory: "All" as PosterCategory,

    // Photo placement
    hasPhoto: false,
    photoSrc: "",
    offsetX: 0,
    offsetY: 0,
    scale: 1,

    // Remove BG
    removeBgBusy: false,
    removeBgQualityUsed: null as BackgroundRemovalQuality | null,
    removeBgMessage: "",
    removeBgQuality: "standard" as BackgroundRemovalQuality,

    // Export
    exportBusy: false,
    exportMessage: "",

    // Text
    fullName: "",
    designationLines: [""],
    designationStyles: [{ ...DEFAULT_ROLE_STYLE }],
    // Store offsets for each designation line independently.
    designationOffsets: [{ x: 0, y: 0 }],
    activeRoleIndex: 0,
    activeRoleInput: null as HTMLInputElement | null,
    nameScaleAdjust: 1,
    roleScaleAdjust: 1,
    textScaleMin: TEXT_SCALE_MIN,
    textScaleMax: TEXT_SCALE_MAX,
    maxDesignations: MAX_DESIGNATIONS,
    nameOffsetX: 0,
    nameOffsetY: 0,
    // roleOffsetX/Y removed in favor of designationOffsets array
    nameOffsetsByFrame: {} as Record<string, { x: number; y: number }>,
    // Store array of offsets per frame
    roleOffsetsByFrame: {} as Record<string, { x: number; y: number }[]>,
    roleStylesByFrame: {} as Record<string, DesignationStyle[]>,

    // Suggestions
    nameSuggestions: [] as string[],
    roleSuggestions: [] as string[],
    nameSuggestionsVisible: false,
    roleSuggestionsVisible: false,
    nameSuggestionIndex: -1,
    roleSuggestionIndex: -1,

    get photoTransformStyle() {
      return `transform: translate(-50%, -50%) translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale});`;
    },

    get activeFrameConfig() {
      return (
        this.frames.find((frame) => frame.src === this.activeFrame) ??
        this.frames[0]
      );
    },

    get filteredFrames() {
      const selected = this.selectedCategory;
      if (selected === "All") {
        return this.frames;
      }

      const selectedReal = selected as PosterRealCategory;

      return this.frames.filter((frame) => {
        const categories = frame.categories;
        if (!categories || categories.length === 0) {
          // Global frame: visible in every category.
          return true;
        }
        return categories.includes(selectedReal);
      });
    },

    get nameTransformStyle() {
      const { nameText } = this.activeFrameConfig;
      return [
        `left: ${nameText.xPct}%`,
        `top: ${nameText.yPct}%`,
        `color: ${nameText.color}`,
        `font-family: ${nameText.fontFamily}`,
        `font-size: calc(${nameText.fontSizePx} * 1em)`,
        `font-weight: ${nameText.fontWeight}`,
        `background-color: ${nameText.backgroundColor}`,
        "transform-origin: left top",
        `transform: translate(${this.nameOffsetX}px, ${this.nameOffsetY}px) scale(${nameText.scale * this.nameScaleAdjust})`,
      ].join("; ");
    },

    getRoleTransformStyle(index: number) {
      const { roleText } = this.activeFrameConfig;
      const offsets = this.designationOffsets[index] || { x: 0, y: 0 };
      const style = this.designationStyles[index];
      const fontSize = style?.fontSizePx ?? roleText.fontSizePx;
      const color = style?.color ?? roleText.color;
      const fontWeight = style?.fontWeight ?? roleText.fontWeight;
      return [
        `left: ${roleText.xPct}%`,
        `top: ${roleText.yPct}%`,
        `color: ${color}`,
        `font-family: ${roleText.fontFamily}`,
        `font-size: calc(${fontSize} * 1em)`,
        `font-weight: ${fontWeight}`,
        `background-color: ${roleText.backgroundColor}`,
        "transform-origin: left top",
        `transform: translate(${offsets.x}px, ${offsets.y}px) scale(${roleText.scale * this.roleScaleAdjust})`,
      ].join("; ");
    },

    getDefaultDesignationStyle() {
      const { roleText } = this.activeFrameConfig;
      return {
        fontSizePx: roleText.fontSizePx,
        color: roleText.color,
        fontWeight: roleText.fontWeight,
      };
    },

    getDesignationStyle(index: number) {
      return this.designationStyles[index] ?? this.getDefaultDesignationStyle();
    },

    ensureDesignationStyle(index: number) {
      if (!this.designationStyles[index]) {
        this.designationStyles[index] = this.getDefaultDesignationStyle();
      }
      return this.designationStyles[index];
    },

    clampDesignationFontSize(value: number) {
      const fallback = this.getDefaultDesignationStyle().fontSizePx;
      if (!Number.isFinite(value)) {
        return fallback;
      }
      return Math.min(96, Math.max(12, Math.round(value)));
    },

    setDesignationFontSize(index: number, event: Event) {
      const target = event.target as HTMLInputElement;
      const clamped = this.clampDesignationFontSize(Number(target.value));
      const style = this.ensureDesignationStyle(index);
      style.fontSizePx = clamped;
      target.value = String(clamped);
      this.saveActiveTextOffsets();
    },

    setDesignationFontColor(index: number, event: Event) {
      const target = event.target as HTMLInputElement;
      if (!target.value) {
        return;
      }
      const style = this.ensureDesignationStyle(index);
      style.color = target.value;
      this.saveActiveTextOffsets();
    },

    setDesignationFontWeight(index: number, event: Event) {
      const target = event.target as HTMLSelectElement;
      const style = this.ensureDesignationStyle(index);
      style.fontWeight =
        target.value || this.getDefaultDesignationStyle().fontWeight;
      this.saveActiveTextOffsets();
    },

    clampTextScale(value: number) {
      const rounded = Number(value.toFixed(2));
      return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, rounded));
    },

    adjustNameScale(direction: number) {
      this.nameScaleAdjust = this.clampTextScale(
        this.nameScaleAdjust + direction * TEXT_SCALE_STEP,
      );
    },

    adjustRoleScale(direction: number) {
      this.roleScaleAdjust = this.clampTextScale(
        this.roleScaleAdjust + direction * TEXT_SCALE_STEP,
      );
    },

    addDesignation() {
      if (this.designationLines.length >= MAX_DESIGNATIONS) return;

      this.designationLines.push("");
      const newIndex = this.designationLines.length - 1;
      this.activeRoleIndex = newIndex;

      // Calculate center position relative to the frame's role anchor for X
      const overlay = this.ref<HTMLDivElement>("frameOverlay");
      let newX = 0;
      let newY = 0;

      if (overlay) {
        const rect = overlay.getBoundingClientRect();
        const { roleText } = this.activeFrameConfig;

        // Target is center (50%) - Anchor (xPct%)
        if (rect.width > 0 && rect.height > 0) {
          newX = (rect.width * (50 - roleText.xPct)) / 100;
        }
      }

      // Match the Y offset of the main designation (index 0)
      if (this.designationOffsets.length > 0) {
        newY = this.designationOffsets[0].y;
      }

      // Initialize offsets for the new designation
      this.designationOffsets.push({ x: newX, y: newY });
      this.designationStyles.push(this.getDefaultDesignationStyle());
      this.saveActiveTextOffsets();
    },

    saveActiveTextOffsets() {
      const key = this.activeFrame;
      if (!key) return;
      this.nameOffsetsByFrame[key] = {
        x: this.nameOffsetX,
        y: this.nameOffsetY,
      };
      // Save deep copy of offsets
      this.roleOffsetsByFrame[key] = this.designationOffsets.map((o) => ({
        ...o,
      }));
      this.roleStylesByFrame[key] = this.designationStyles.map((style) => ({
        ...style,
      }));
    },

    applyTextOffsetsForFrame(frameSrc: string) {
      const nameOffsets = this.nameOffsetsByFrame[frameSrc];
      this.nameOffsetX = nameOffsets?.x ?? 0;
      this.nameOffsetY = nameOffsets?.y ?? 0;

      const savedOffsets = this.roleOffsetsByFrame[frameSrc];
      const currentOffsets = this.designationOffsets;

      // Merge strategy: Use saved offset if available for the line index,
      // otherwise preserve the current offset (carry forward).
      this.designationOffsets = this.designationLines.map((_, i) => {
        if (savedOffsets?.[i]) {
          return { ...savedOffsets[i] };
        }
        // If no saved offset for this index (e.g. new line added since visiting frame),
        // keep the current position so it doesn't jump to 0,0.
        // Fallback to 0,0 only if we have no current offset either (shouldn't happen).
        return currentOffsets[i] ? { ...currentOffsets[i] } : { x: 0, y: 0 };
      });
    },

    applyDesignationStylesForFrame(frameSrc: string) {
      const savedStyles = this.roleStylesByFrame[frameSrc];
      const fallback = this.getDefaultDesignationStyle();
      this.designationStyles = this.designationLines.map((_, i) => {
        if (savedStyles?.[i]) {
          return { ...savedStyles[i] };
        }
        return { ...fallback };
      });
    },
    clampDragDelta(target: HTMLElement, dx: number, dy: number) {
      const frameOverlay = this.ref<HTMLDivElement>("frameOverlay");
      if (!frameOverlay) {
        return { dx, dy };
      }

      const frameRect = frameOverlay.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const minDx = frameRect.left - targetRect.left;
      const maxDx = frameRect.right - targetRect.right;
      const minDy = frameRect.top - targetRect.top;
      const maxDy = frameRect.bottom - targetRect.bottom;

      const clampedDx = Math.min(Math.max(dx, minDx), maxDx);
      const clampedDy = Math.min(Math.max(dy, minDy), maxDy);

      return { dx: clampedDx, dy: clampedDy };
    },

    ref<T = unknown>(key: string): T | undefined {
      const refs = (this as unknown as { $refs?: Record<string, unknown> })
        .$refs;
      return refs?.[key] as T | undefined;
    },

    init() {
      const inferred = getDefaultPosterCategoryForHostname(
        window.location.hostname,
      );
      this.setCategory(inferred);

      this.applyTextOffsetsForFrame(this.activeFrame);
      this.applyDesignationStylesForFrame(this.activeFrame);

      const frameImage = this.ref<HTMLImageElement>("frameImage");
      if (frameImage) {
        frameImage.addEventListener("load", () => {
          this.updateFrameOverlay();
        });
        if (frameImage.complete) {
          this.updateFrameOverlay();
        }
      }

      window.addEventListener("resize", () => {
        this.updateFrameOverlay();
      });

      this.updateFrameOverlay();
    },

    setCategory(category: PosterCategory) {
      this.selectedCategory = category;

      // If the chosen category has no frames, fall back to All.
      if (this.selectedCategory !== "All" && this.filteredFrames.length === 0) {
        this.selectedCategory = "All";
      }

      // Keep the active frame consistent with the filtered set.
      const allowed = new Set(this.filteredFrames.map((f) => f.src));
      if (!allowed.has(this.activeFrame)) {
        const first = this.filteredFrames[0];
        if (first) {
          this.saveActiveTextOffsets();
          this.activeFrame = first.src;
          this.applyTextOffsetsForFrame(this.activeFrame);
          this.applyDesignationStylesForFrame(this.activeFrame);
          queueMicrotask(() => this.updateFrameOverlay());
        }
      }
    },

    setFrame(src: string) {
      if (src === this.activeFrame) return;
      this.saveActiveTextOffsets();
      this.activeFrame = src;
      this.applyTextOffsetsForFrame(this.activeFrame);
      this.applyDesignationStylesForFrame(this.activeFrame);
      queueMicrotask(() => this.updateFrameOverlay());
    },

    updateFrameOverlay() {
      const stage = this.ref<HTMLDivElement>("stage");
      const frameImage = this.ref<HTMLImageElement>("frameImage");
      if (!stage || !frameImage) return;

      if (!frameImage.naturalWidth || !frameImage.naturalHeight) {
        return;
      }

      const stageRect = stage.getBoundingClientRect();
      const stageWidth = stageRect.width;
      const stageHeight = stageRect.height;
      if (stageWidth <= 0 || stageHeight <= 0) {
        return;
      }

      const rect = computeContainedRect(
        stageWidth,
        stageHeight,
        frameImage.naturalWidth,
        frameImage.naturalHeight,
      );

      // The previous logic calculated frameOffsetX/Y relative to the stage.
      // computeContainedRect returns x, y which are the offsets.
      // So we can directly use rect.x and rect.y.
      // And rect.width/height.

      stage.style.setProperty("--frame-x", `${rect.x}px`);
      stage.style.setProperty("--frame-y", `${rect.y}px`);
      stage.style.setProperty("--frame-w", `${rect.width}px`);
      stage.style.setProperty("--frame-h", `${rect.height}px`);
      stage.style.setProperty(
        "--frame-scale",
        `${rect.width / frameImage.naturalWidth}`,
      );
      stage.style.setProperty("--frame-font-size", `${rect.width / 1080}px`);
    },

    onPhotoFileChange(event: Event) {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (currentPhotoObjectUrl) {
        URL.revokeObjectURL(currentPhotoObjectUrl);
      }
      currentPhotoObjectUrl = URL.createObjectURL(file);
      this.setPhotoState(currentPhotoObjectUrl);
    },

    setPhotoState(source: string) {
      removeBgRunId += 1;

      if (currentPhotoObjectUrl && source !== currentPhotoObjectUrl) {
        URL.revokeObjectURL(currentPhotoObjectUrl);
        currentPhotoObjectUrl = null;
      }

      this.photoSrc = source;
      this.hasPhoto = true;
      this.removeBgQualityUsed = null;
      this.removeBgQuality = "standard";
      this.removeBgBusy = false;
      this.removeBgMessage = "";

      this.offsetX = 0;
      this.offsetY = 0;

      const scaleEl = this.ref<HTMLInputElement>("scaleRange");
      if (scaleEl) {
        this.scale = Number(scaleEl.value);
      }
    },

    clearPhoto() {
      removeBgRunId += 1;

      if (currentPhotoObjectUrl) {
        URL.revokeObjectURL(currentPhotoObjectUrl);
        currentPhotoObjectUrl = null;
      }

      const input = this.ref<HTMLInputElement>("photoUpload");
      if (input) {
        input.value = "";
      }

      this.photoSrc = "";
      this.hasPhoto = false;
      this.removeBgQualityUsed = null;
      this.removeBgQuality = "standard";
      this.removeBgBusy = false;
      this.removeBgMessage = "";
      this.offsetX = 0;
      this.offsetY = 0;
    },

    onPhotoPointerDown(event: PointerEvent) {
      if (!this.hasPhoto) return;
      event.preventDefault();

      dragTarget = { type: "photo" };
      startX = event.clientX;
      startY = event.clientY;

      const photoContainer = this.ref<HTMLDivElement>("photoContainer");
      if (photoContainer) {
        photoContainer.setPointerCapture(event.pointerId);
        photoContainer.classList.add("cursor-grabbing");
        photoContainer.classList.remove("cursor-grab");
      }
    },

    onPhotoPointerMove(event: PointerEvent) {
      if (!dragTarget || dragTarget.type !== "photo") return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      this.offsetX += dx;
      this.offsetY += dy;
      startX = event.clientX;
      startY = event.clientY;
    },

    onPhotoPointerUp(event: PointerEvent) {
      if (!dragTarget || dragTarget.type !== "photo") return;
      dragTarget = null;
      const photoContainer = this.ref<HTMLDivElement>("photoContainer");
      if (photoContainer) {
        photoContainer.classList.remove("cursor-grabbing");
        photoContainer.classList.add("cursor-grab");
        if (photoContainer.hasPointerCapture(event.pointerId)) {
          photoContainer.releasePointerCapture(event.pointerId);
        }
      }
    },

    onNamePointerDown(event: PointerEvent) {
      event.preventDefault();

      dragTarget = { type: "name" };
      startX = event.clientX;
      startY = event.clientY;

      const nameText = this.ref<HTMLElement>("nameText");
      if (nameText) {
        nameText.setPointerCapture(event.pointerId);
        nameText.classList.add("cursor-grabbing");
        nameText.classList.remove("cursor-grab");
      }
    },

    onNamePointerMove(event: PointerEvent) {
      if (!dragTarget || dragTarget.type !== "name") return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const nameText = this.ref<HTMLElement>("nameText");
      if (!nameText) return;
      const clamped = this.clampDragDelta(nameText, dx, dy);
      this.nameOffsetX += clamped.dx;
      this.nameOffsetY += clamped.dy;
      startX = event.clientX;
      startY = event.clientY;
    },

    onNamePointerUp(event: PointerEvent) {
      if (!dragTarget || dragTarget.type !== "name") return;
      dragTarget = null;
      const nameText = this.ref<HTMLElement>("nameText");
      if (nameText) {
        nameText.classList.remove("cursor-grabbing");
        nameText.classList.add("cursor-grab");
        if (nameText.hasPointerCapture(event.pointerId)) {
          nameText.releasePointerCapture(event.pointerId);
        }
      }
      this.saveActiveTextOffsets();
    },

    onRolePointerDown(event: PointerEvent, index: number) {
      event.preventDefault();

      dragTarget = { type: "role", index };
      startX = event.clientX;
      startY = event.clientY;

      // We need to target the specific element.
      // Using ref in loop creates an array of elements or we construct ID?
      // Best to rely on event.target or construct an ID.
      // In Alpine x-for, IDs might be tricky if not explicit.
      // We will assume the element has an ID `roleText-{index}`
      const roleText = document.getElementById(`roleText-${index}`);

      if (roleText) {
        roleText.setPointerCapture(event.pointerId);
        roleText.classList.add("cursor-grabbing");
        roleText.classList.remove("cursor-grab");
      }
    },

    onRolePointerMove(event: PointerEvent) {
      if (!dragTarget || dragTarget.type !== "role") return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const index = dragTarget.index;

      const roleText = document.getElementById(`roleText-${index}`);
      if (!roleText) return;

      const clamped = this.clampDragDelta(roleText, dx, dy);

      if (this.designationOffsets[index]) {
        this.designationOffsets[index].x += clamped.dx;
        this.designationOffsets[index].y += clamped.dy;
      }

      startX = event.clientX;
      startY = event.clientY;
    },

    onRolePointerUp(event: PointerEvent) {
      if (!dragTarget || dragTarget.type !== "role") return;

      const index = dragTarget.index;
      dragTarget = null;

      const roleText = document.getElementById(`roleText-${index}`);
      if (roleText) {
        roleText.classList.remove("cursor-grabbing");
        roleText.classList.add("cursor-grab");
        if (roleText.hasPointerCapture(event.pointerId)) {
          roleText.releasePointerCapture(event.pointerId);
        }
      }
      this.saveActiveTextOffsets();
    },

    async removeBackground(quality: BackgroundRemovalQuality = "standard") {
      if (!this.hasPhoto || !this.photoSrc) {
        return;
      }

      if (this.removeBgQualityUsed === quality) {
        return;
      }

      removeBgRunId += 1;
      const runId = removeBgRunId;
      let timeoutHandle: number | undefined;
      const isHighQuality = quality === "hq";

      this.removeBgBusy = true;
      this.removeBgMessage = isHighQuality ? "Downloading HD model..." : "";

      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 0);
      });
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      try {
        const processedSource = await Promise.race([
          removeBackgroundImage(this.photoSrc, quality),
          new Promise<string>((_, reject) => {
            timeoutHandle = window.setTimeout(() => {
              reject(new Error("Background removal timed out."));
            }, 45000);
          }),
        ]);

        if (runId !== removeBgRunId) {
          return;
        }

        if (currentPhotoObjectUrl) {
          URL.revokeObjectURL(currentPhotoObjectUrl);
          currentPhotoObjectUrl = null;
        }

        this.photoSrc = processedSource;
        this.removeBgQualityUsed = quality;
        this.removeBgMessage = isHighQuality
          ? "Background removed (HD)"
          : "Background removed";
      } catch (error) {
        console.error("Error during background removal:", error);
        if (runId === removeBgRunId) {
          this.removeBgMessage = isHighQuality
            ? "HD background removal failed."
            : "Background removal failed.";
        }
      } finally {
        if (timeoutHandle) {
          window.clearTimeout(timeoutHandle);
        }
        if (runId === removeBgRunId) {
          this.removeBgBusy = false;
        }
      }
    },

    async exportPoster() {
      const stage = this.ref<HTMLDivElement>("stage");
      const frameImage = this.ref<HTMLImageElement>("frameImage");
      const photoImage = this.ref<HTMLImageElement>("photoImage");
      const nameText = this.ref<HTMLElement>("nameText");
      if (!stage || !frameImage || !nameText) {
        console.error("Missing elements for export");
        return;
      }

      this.exportBusy = true;
      this.exportMessage = "";

      const designationsForExport = this.designationLines.reduce<
        {
          text: string;
          offsetX: number;
          offsetY: number;
          element: HTMLElement;
        }[]
      >((acc, line, index) => {
        if (!line.trim()) {
          return acc;
        }
        const element = document.getElementById(
          `roleText-${index}`,
        ) as HTMLElement | null;
        if (!element) {
          return acc;
        }
        acc.push({
          text: line,
          offsetX: this.designationOffsets[index]?.x ?? 0,
          offsetY: this.designationOffsets[index]?.y ?? 0,
          element,
        });
        return acc;
      }, []);

      try {
        await generatePoster({
          stage,
          frameImage,
          photoImage,
          nameText,
          fullName: this.fullName,
          designations: designationsForExport,
          nameBaseXPct: this.activeFrameConfig.nameText.xPct,
          nameBaseYPct: this.activeFrameConfig.nameText.yPct,
          roleBaseXPct: this.activeFrameConfig.roleText.xPct,
          roleBaseYPct: this.activeFrameConfig.roleText.yPct,
          nameScale:
            this.activeFrameConfig.nameText.scale * this.nameScaleAdjust,
          roleScale:
            this.activeFrameConfig.roleText.scale * this.roleScaleAdjust,
          hasOverlay: this.activeFrameConfig.hasOverlay,
          overlaySrc: this.activeFrameConfig.overlaySrc ?? "",
          nameOffsetX: this.nameOffsetX,
          nameOffsetY: this.nameOffsetY,
          offsetX: this.offsetX,
          offsetY: this.offsetY,
          scale: this.scale,
          hasPhoto: this.hasPhoto,
          photoSrc: this.photoSrc,
        });
      } catch (error) {
        console.error("Error during export:", error);
        this.exportMessage = "Export failed.";
      } finally {
        this.exportBusy = false;
      }
    },
    // ----- Transliteration suggestions -----

    async fetchSuggestions(
      input: HTMLInputElement | HTMLTextAreaElement,
      kind: "name" | "role",
    ) {
      const { before } = splitByCursor(input);
      const { token } = extractLastToken(before);
      if (!token.trim()) {
        if (kind === "name") {
          this.nameSuggestions = [];
          this.nameSuggestionsVisible = false;
          this.nameSuggestionIndex = -1;
        } else {
          this.roleSuggestions = [];
          this.roleSuggestionsVisible = false;
          this.roleSuggestionIndex = -1;
        }
        return;
      }

      let requestId = 0;
      if (kind === "name") {
        nameLatestRequestId += 1;
        requestId = nameLatestRequestId;
      } else {
        roleLatestRequestId += 1;
        requestId = roleLatestRequestId;
      }

      try {
        const suggestions = await getSuggestions(token);

        const stillLatest =
          kind === "name"
            ? requestId === nameLatestRequestId
            : requestId === roleLatestRequestId;
        if (!stillLatest) return;

        if (kind === "name") {
          this.nameSuggestions = suggestions;
          this.nameSuggestionsVisible = suggestions.length > 0;
          this.nameSuggestionIndex = suggestions.length > 0 ? 0 : -1;
        } else {
          this.roleSuggestions = suggestions;
          this.roleSuggestionsVisible = suggestions.length > 0;
          this.roleSuggestionIndex = suggestions.length > 0 ? 0 : -1;
        }
      } catch (error) {
        console.error("Transliteration error:", error);
      }
    },

    setSuggestionIndex(kind: "name" | "role", nextIndex: number) {
      const suggestions =
        kind === "name" ? this.nameSuggestions : this.roleSuggestions;
      const count = suggestions.length;
      if (count === 0) {
        if (kind === "name") {
          this.nameSuggestionIndex = -1;
        } else {
          this.roleSuggestionIndex = -1;
        }
        return;
      }

      const normalized = ((nextIndex % count) + count) % count;
      if (kind === "name") {
        this.nameSuggestionIndex = normalized;
      } else {
        this.roleSuggestionIndex = normalized;
      }
    },

    scheduleSuggestions(kind: "name" | "role") {
      const input =
        kind === "name"
          ? this.ref<HTMLInputElement>("fullNameInput")
          : this.activeRoleInput;
      if (!input) return;

      if (kind === "name") {
        if (nameDebounceHandle) {
          window.clearTimeout(nameDebounceHandle);
        }
        nameDebounceHandle = window.setTimeout(
          () => void this.fetchSuggestions(input, "name"),
          TRANSLITERATE_DEBOUNCE_MS,
        );
      } else {
        if (roleDebounceHandle) {
          window.clearTimeout(roleDebounceHandle);
        }
        roleDebounceHandle = window.setTimeout(
          () => void this.fetchSuggestions(input, "role"),
          TRANSLITERATE_DEBOUNCE_MS,
        );
      }
    },

    applySuggestion(kind: "name" | "role", suggestion: string) {
      const input =
        kind === "name"
          ? this.ref<HTMLInputElement>("fullNameInput")
          : this.activeRoleInput;
      if (!input) return;

      const { before, after } = splitByCursor(input);
      const { prefix } = extractLastToken(before);
      const nextValue = `${prefix}${suggestion}${after}`;

      input.value = nextValue;
      const newCursor = (prefix + suggestion).length;
      input.setSelectionRange(newCursor, newCursor);

      if (kind === "name") {
        this.fullName = nextValue;
        suppressNextNameSuggestions = true;
        this.nameSuggestionsVisible = false;
      } else {
        const index = this.activeRoleIndex;
        if (index >= 0 && index < this.designationLines.length) {
          this.designationLines[index] = nextValue;
        }
        suppressNextRoleSuggestions = true;
        this.roleSuggestionsVisible = false;
      }
    },

    onNameInput(event: Event) {
      if (suppressNextNameSuggestions) {
        suppressNextNameSuggestions = false;
        this.nameSuggestions = [];
        this.nameSuggestionsVisible = false;
        this.nameSuggestionIndex = -1;
        return;
      }

      const input = event.target as HTMLInputElement;
      this.fullName = input.value;
      this.scheduleSuggestions("name");
    },

    onRoleInput(event: Event, index: number) {
      if (suppressNextRoleSuggestions) {
        suppressNextRoleSuggestions = false;
        this.roleSuggestions = [];
        this.roleSuggestionsVisible = false;
        this.roleSuggestionIndex = -1;
        return;
      }

      const input = event.target as HTMLInputElement;
      this.activeRoleInput = input;
      this.activeRoleIndex = index;
      this.designationLines[index] = input.value;
      this.scheduleSuggestions("role");
    },

    onNameFocus() {
      this.scheduleSuggestions("name");
    },

    onRoleFocus(event: Event, index: number) {
      const input = event.target as HTMLInputElement;
      this.activeRoleInput = input;
      this.activeRoleIndex = index;
      this.scheduleSuggestions("role");
    },

    onNameBlur() {
      window.setTimeout(() => {
        this.nameSuggestionsVisible = false;
        this.nameSuggestionIndex = -1;
      }, 100);
    },

    onRoleBlur() {
      window.setTimeout(() => {
        this.roleSuggestionsVisible = false;
        this.roleSuggestionIndex = -1;
      }, 100);
    },

    onNameKeydown(event: KeyboardEvent) {
      const isArrowDown = event.key === "ArrowDown";
      const isArrowUp = event.key === "ArrowUp";
      const shouldApply =
        event.key === "Enter" || event.key === "Tab" || event.key === "Return";

      if (isArrowDown || isArrowUp) {
        if (!this.nameSuggestionsVisible && this.nameSuggestions.length > 0) {
          this.nameSuggestionsVisible = true;
        }
        if (this.nameSuggestions.length > 0) {
          event.preventDefault();
          const delta = isArrowDown ? 1 : -1;
          const current = this.nameSuggestionIndex;
          const next = current === -1 ? 0 : current + delta;
          this.setSuggestionIndex("name", next);
        }
        return;
      }

      if (!shouldApply) return;
      if (!this.nameSuggestionsVisible) return;
      const index = this.nameSuggestionIndex;
      const picked =
        index >= 0 ? this.nameSuggestions[index] : this.nameSuggestions[0];
      if (!picked) return;
      event.preventDefault();
      this.applySuggestion("name", picked);
    },

    onRoleKeydown(event: KeyboardEvent) {
      this.activeRoleInput = event.target as HTMLInputElement;
      const isEnter = event.key === "Enter" || event.key === "Return";
      const isArrowDown = event.key === "ArrowDown";
      const isArrowUp = event.key === "ArrowUp";
      const shouldApply =
        event.key === "Enter" || event.key === "Tab" || event.key === "Return";

      if (isArrowDown || isArrowUp) {
        if (!this.roleSuggestionsVisible && this.roleSuggestions.length > 0) {
          this.roleSuggestionsVisible = true;
        }
        if (this.roleSuggestions.length > 0) {
          event.preventDefault();
          const delta = isArrowDown ? 1 : -1;
          const current = this.roleSuggestionIndex;
          const next = current === -1 ? 0 : current + delta;
          this.setSuggestionIndex("role", next);
        }
        return;
      }

      if (!shouldApply) return;
      if (isEnter && !this.roleSuggestionsVisible) return;
      if (!this.roleSuggestionsVisible) return;
      const index = this.roleSuggestionIndex;
      const picked =
        index >= 0 ? this.roleSuggestions[index] : this.roleSuggestions[0];
      if (!picked) return;
      event.preventDefault();
      this.applySuggestion("role", picked);
    },

    pickNameSuggestion(value: string) {
      this.applySuggestion("name", value);
    },

    pickRoleSuggestion(value: string) {
      this.applySuggestion("role", value);
    },
  };
});

startAlpine();
