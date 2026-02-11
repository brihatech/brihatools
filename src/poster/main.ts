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

enforcePosterOnlyHosts();

const Alpine = getAlpine();

Alpine.data("posterBuilder", () => {
  let currentPhotoObjectUrl: string | null = null;
  let removeBgRunId = 0;

  // Drag state (not reactive)
  let dragTarget: "photo" | "name" | "role" | null = null;
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
    designation: "",
    nameOffsetX: 0,
    nameOffsetY: 0,
    roleOffsetX: 0,
    roleOffsetY: 0,
    nameOffsetsByFrame: {} as Record<string, { x: number; y: number }>,
    roleOffsetsByFrame: {} as Record<string, { x: number; y: number }>,

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
        `transform: translate(${this.nameOffsetX}px, ${this.nameOffsetY}px) scale(${nameText.scale})`,
      ].join("; ");
    },

    get roleTransformStyle() {
      const { roleText } = this.activeFrameConfig;
      return [
        `left: ${roleText.xPct}%`,
        `top: ${roleText.yPct}%`,
        `color: ${roleText.color}`,
        `font-family: ${roleText.fontFamily}`,
        `font-size: calc(${roleText.fontSizePx} * 1em)`,
        "line-height: 1.1",
        `font-weight: ${roleText.fontWeight}`,
        `background-color: ${roleText.backgroundColor}`,
        "transform-origin: left top",
        `transform: translate(${this.roleOffsetX}px, ${this.roleOffsetY}px) scale(${roleText.scale})`,
      ].join("; ");
    },

    saveActiveTextOffsets() {
      const key = this.activeFrame;
      if (!key) return;
      this.nameOffsetsByFrame[key] = {
        x: this.nameOffsetX,
        y: this.nameOffsetY,
      };
      this.roleOffsetsByFrame[key] = {
        x: this.roleOffsetX,
        y: this.roleOffsetY,
      };
    },

    applyTextOffsetsForFrame(frameSrc: string) {
      const nameOffsets = this.nameOffsetsByFrame[frameSrc];
      this.nameOffsetX = nameOffsets?.x ?? 0;
      this.nameOffsetY = nameOffsets?.y ?? 0;
      const roleOffsets = this.roleOffsetsByFrame[frameSrc];
      this.roleOffsetX = roleOffsets?.x ?? 0;
      this.roleOffsetY = roleOffsets?.y ?? 0;
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
          queueMicrotask(() => this.updateFrameOverlay());
        }
      }
    },

    setFrame(src: string) {
      if (src === this.activeFrame) return;
      this.saveActiveTextOffsets();
      this.activeFrame = src;
      this.applyTextOffsetsForFrame(this.activeFrame);
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

      dragTarget = "photo";
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
      if (dragTarget !== "photo") return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      this.offsetX += dx;
      this.offsetY += dy;
      startX = event.clientX;
      startY = event.clientY;
    },

    onPhotoPointerUp(event: PointerEvent) {
      if (dragTarget !== "photo") return;
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

      dragTarget = "name";
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
      if (dragTarget !== "name") return;

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
      if (dragTarget !== "name") return;
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

    onRolePointerDown(event: PointerEvent) {
      event.preventDefault();

      dragTarget = "role";
      startX = event.clientX;
      startY = event.clientY;

      const roleText = this.ref<HTMLElement>("roleText");
      if (roleText) {
        roleText.setPointerCapture(event.pointerId);
        roleText.classList.add("cursor-grabbing");
        roleText.classList.remove("cursor-grab");
      }
    },

    onRolePointerMove(event: PointerEvent) {
      if (dragTarget !== "role") return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const roleText = this.ref<HTMLElement>("roleText");
      if (!roleText) return;
      const clamped = this.clampDragDelta(roleText, dx, dy);
      this.roleOffsetX += clamped.dx;
      this.roleOffsetY += clamped.dy;
      startX = event.clientX;
      startY = event.clientY;
    },

    onRolePointerUp(event: PointerEvent) {
      if (dragTarget !== "role") return;
      dragTarget = null;
      const roleText = this.ref<HTMLElement>("roleText");
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
      const roleText = this.ref<HTMLElement>("roleText");

      if (!stage || !frameImage || !nameText || !roleText) {
        return;
      }

      this.exportBusy = true;
      this.exportMessage = "";

      try {
        await generatePoster({
          stage,
          frameImage,
          photoImage,
          nameText,
          roleText,
          fullName: this.fullName,
          designation: this.designation,
          nameBaseXPct: this.activeFrameConfig.nameText.xPct,
          nameBaseYPct: this.activeFrameConfig.nameText.yPct,
          roleBaseXPct: this.activeFrameConfig.roleText.xPct,
          roleBaseYPct: this.activeFrameConfig.roleText.yPct,
          nameScale: this.activeFrameConfig.nameText.scale,
          roleScale: this.activeFrameConfig.roleText.scale,
          hasOverlay: this.activeFrameConfig.hasOverlay,
          overlaySrc: this.activeFrameConfig.overlaySrc ?? "",
          nameOffsetX: this.nameOffsetX,
          nameOffsetY: this.nameOffsetY,
          roleOffsetX: this.roleOffsetX,
          roleOffsetY: this.roleOffsetY,
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
          : this.ref<HTMLTextAreaElement>("roleInput");
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
          : this.ref<HTMLTextAreaElement>("roleInput");
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
        this.designation = nextValue;
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

    onRoleInput(event: Event) {
      if (suppressNextRoleSuggestions) {
        suppressNextRoleSuggestions = false;
        this.roleSuggestions = [];
        this.roleSuggestionsVisible = false;
        this.roleSuggestionIndex = -1;
        return;
      }

      const input = event.target as HTMLTextAreaElement;
      this.designation = input.value;
      this.scheduleSuggestions("role");
    },

    onNameFocus() {
      this.scheduleSuggestions("name");
    },

    onRoleFocus() {
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
      const isEnter = event.key === "Enter" || event.key === "Return";
      if (isEnter && event.shiftKey) {
        const input = event.target as HTMLTextAreaElement;
        const value = input.value;
        const start = input.selectionStart ?? value.length;
        const end = input.selectionEnd ?? value.length;
        const nextValue = `${value.slice(0, start)}\n${value.slice(end)}`;
        input.value = nextValue;
        input.setSelectionRange(start + 1, start + 1);
        this.designation = nextValue;
        event.preventDefault();
        return;
      }

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
      if (isEnter && !this.roleSuggestionsVisible) {
        event.preventDefault();
        return;
      }
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
