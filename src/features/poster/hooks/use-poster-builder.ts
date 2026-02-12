import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type BackgroundRemovalQuality,
  removeBackground as removeBackgroundImage,
} from "../lib/background";
import { computeContainedRect, generatePoster } from "../lib/canvas";
import {
  getDefaultPosterCategoryForHostname,
  type PosterCategory,
  type PosterRealCategory,
} from "../lib/category";
import { DEFAULT_FRAME_SRC, FRAMES, type FrameConfig } from "../lib/frames";

const TEXT_SCALE_STEP = 0.05;
const MAX_DESIGNATIONS = 5;

export type TextStyleFlags = {
  bold: boolean;
  italic: boolean;
};

const DEFAULT_TEXT_STYLE: TextStyleFlags = {
  bold: false,
  italic: false,
};

export type SelectedTextId = "name" | "photo" | number | null;

export function usePosterBuilder() {
  const [activeFrame, setActiveFrame] = useState(DEFAULT_FRAME_SRC);
  const [selectedCategory, setSelectedCategory] =
    useState<PosterCategory>("All");

  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoSrc, setPhotoSrc] = useState("");
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [scale, setScale] = useState(1);

  const [removeBgBusy, setRemoveBgBusy] = useState(false);
  const [removeBgQualityUsed, setRemoveBgQualityUsed] =
    useState<BackgroundRemovalQuality | null>(null);
  const [removeBgMessage, setRemoveBgMessage] = useState("");
  const [removeBgQuality, setRemoveBgQuality] =
    useState<BackgroundRemovalQuality>("standard");

  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState("");

  const [fullName, setFullName] = useState("");
  const [designationLines, setDesignationLines] = useState<string[]>([""]);
  const [designationOffsets, setDesignationOffsets] = useState<
    { x: number; y: number }[]
  >([{ x: 0, y: 0 }]);
  const [activeRoleIndex, setActiveRoleIndex] = useState(0);

  const [nameScaleAdjust, setNameScaleAdjust] = useState(1);
  const [roleScaleAdjusts, setRoleScaleAdjusts] = useState<number[]>([1]);
  const [nameColor, setNameColor] = useState<string | null>(null);
  const [designationColors, setDesignationColors] = useState<(string | null)[]>(
    [null],
  );
  const [nameTextStyle, setNameTextStyle] = useState<TextStyleFlags>({
    ...DEFAULT_TEXT_STYLE,
  });
  const [designationTextStyles, setDesignationTextStyles] = useState<
    TextStyleFlags[]
  >([{ ...DEFAULT_TEXT_STYLE }]);
  const [selectedTextId, setSelectedTextId] = useState<SelectedTextId>(null);
  const [nameOffsetX, setNameOffsetX] = useState(0);
  const [nameOffsetY, setNameOffsetY] = useState(0);

  const currentPhotoUrlRef = useRef<string | null>(null);
  const removeBgRunIdRef = useRef(0);
  const nameOffsetsByFrameRef = useRef<
    Record<string, { x: number; y: number }>
  >({});
  const roleOffsetsByFrameRef = useRef<
    Record<string, { x: number; y: number }[]>
  >({});

  const stageRef = useRef<HTMLDivElement>(null);
  const frameImageRef = useRef<HTMLImageElement>(null);
  const photoImageRef = useRef<HTMLImageElement>(null);
  const nameTextRef = useRef<HTMLDivElement>(null);
  const frameOverlayRef = useRef<HTMLDivElement>(null);
  const photoUploadRef = useRef<HTMLInputElement>(null);
  const fullNameInputRef = useRef<HTMLInputElement>(null);
  const activeRoleInputRef = useRef<HTMLInputElement | null>(null);

  const activeFrameConfig = useMemo(
    () => FRAMES.find((f) => f.src === activeFrame) ?? FRAMES[0],
    [activeFrame],
  );

  const filteredFrames = useMemo(() => {
    if (selectedCategory === "All") return FRAMES;
    const cat = selectedCategory as PosterRealCategory;
    return FRAMES.filter((f) => {
      if (!f.categories || f.categories.length === 0) return true;
      return f.categories.includes(cat as FrameConfig["categories"][number]);
    });
  }, [selectedCategory]);

  const adjustNameScale = useCallback((direction: number) => {
    setNameScaleAdjust((prev) =>
      Number((prev + direction * TEXT_SCALE_STEP).toFixed(2)),
    );
  }, []);

  const adjustRoleScale = useCallback((index: number, direction: number) => {
    setRoleScaleAdjusts((prev) =>
      prev.map((s, i) =>
        i === index ? Number((s + direction * TEXT_SCALE_STEP).toFixed(2)) : s,
      ),
    );
  }, []);

  const saveActiveTextOffsets = useCallback(() => {
    nameOffsetsByFrameRef.current[activeFrame] = {
      x: nameOffsetX,
      y: nameOffsetY,
    };
    roleOffsetsByFrameRef.current[activeFrame] = designationOffsets.map(
      (o) => ({ ...o }),
    );
  }, [activeFrame, nameOffsetX, nameOffsetY, designationOffsets]);

  const applyTextOffsetsForFrame = useCallback(
    (frameSrc: string) => {
      const nameOffsets = nameOffsetsByFrameRef.current[frameSrc];
      setNameOffsetX(nameOffsets?.x ?? 0);
      setNameOffsetY(nameOffsets?.y ?? 0);

      const savedOffsets = roleOffsetsByFrameRef.current[frameSrc];
      setDesignationOffsets((current) =>
        designationLines.map((_, i) => {
          if (savedOffsets?.[i]) return { ...savedOffsets[i] };
          return current[i] ? { ...current[i] } : { x: 0, y: 0 };
        }),
      );
    },
    [designationLines],
  );

  const updateFrameOverlay = useCallback(() => {
    const stage = stageRef.current;
    const frameImage = frameImageRef.current;
    if (!stage || !frameImage) return;
    if (!frameImage.naturalWidth || !frameImage.naturalHeight) return;

    const stageRect = stage.getBoundingClientRect();
    if (stageRect.width <= 0 || stageRect.height <= 0) return;

    const rect = computeContainedRect(
      stageRect.width,
      stageRect.height,
      frameImage.naturalWidth,
      frameImage.naturalHeight,
    );

    stage.style.setProperty("--frame-x", `${rect.x}px`);
    stage.style.setProperty("--frame-y", `${rect.y}px`);
    stage.style.setProperty("--frame-w", `${rect.width}px`);
    stage.style.setProperty("--frame-h", `${rect.height}px`);
    stage.style.setProperty(
      "--frame-scale",
      `${rect.width / frameImage.naturalWidth}`,
    );
    stage.style.setProperty("--frame-font-size", `${rect.width / 1080}px`);
  }, []);

  useEffect(() => {
    const inferred = getDefaultPosterCategoryForHostname(
      window.location.hostname,
    );
    setSelectedCategory(inferred);
  }, []);

  useEffect(() => {
    const frameImage = frameImageRef.current;
    if (!frameImage) return;

    const handleLoad = () => updateFrameOverlay();
    frameImage.addEventListener("load", handleLoad);
    if (frameImage.complete) updateFrameOverlay();

    const handleResize = () => updateFrameOverlay();
    window.addEventListener("resize", handleResize);

    return () => {
      frameImage.removeEventListener("load", handleLoad);
      window.removeEventListener("resize", handleResize);
    };
  }, [updateFrameOverlay]);

  useEffect(() => {
    updateFrameOverlay();
  }, [updateFrameOverlay]);

  const setFrameFn = useCallback(
    (src: string) => {
      if (src === activeFrame) return;
      saveActiveTextOffsets();
      setActiveFrame(src);
      applyTextOffsetsForFrame(src);
      queueMicrotask(() => updateFrameOverlay());
    },
    [
      activeFrame,
      saveActiveTextOffsets,
      applyTextOffsetsForFrame,
      updateFrameOverlay,
    ],
  );

  const setCategoryFn = useCallback(
    (category: PosterCategory) => {
      let cat = category;
      if (cat !== "All") {
        const frames = FRAMES.filter(
          (f) =>
            !f.categories ||
            f.categories.length === 0 ||
            f.categories.includes(cat as FrameConfig["categories"][number]),
        );
        if (frames.length === 0) cat = "All";
      }
      setSelectedCategory(cat);

      const newFiltered =
        cat === "All"
          ? FRAMES
          : FRAMES.filter(
              (f) =>
                !f.categories ||
                f.categories.length === 0 ||
                f.categories.includes(cat as FrameConfig["categories"][number]),
            );
      const allowed = new Set(newFiltered.map((f) => f.src));
      if (!allowed.has(activeFrame)) {
        const first = newFiltered[0];
        if (first) {
          saveActiveTextOffsets();
          setActiveFrame(first.src);
          applyTextOffsetsForFrame(first.src);
          queueMicrotask(() => updateFrameOverlay());
        }
      }
    },
    [
      activeFrame,
      saveActiveTextOffsets,
      applyTextOffsetsForFrame,
      updateFrameOverlay,
    ],
  );

  const onPhotoFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (currentPhotoUrlRef.current) {
        URL.revokeObjectURL(currentPhotoUrlRef.current);
      }
      const url = URL.createObjectURL(file);
      currentPhotoUrlRef.current = url;

      removeBgRunIdRef.current += 1;
      setPhotoSrc(url);
      setHasPhoto(true);
      setRemoveBgQualityUsed(null);
      setRemoveBgQuality("standard");
      setRemoveBgBusy(false);
      setRemoveBgMessage("");
      setOffsetX(0);
      setOffsetY(0);
      setSelectedTextId("photo");
    },
    [],
  );

  const clearPhoto = useCallback(() => {
    removeBgRunIdRef.current += 1;
    if (currentPhotoUrlRef.current) {
      URL.revokeObjectURL(currentPhotoUrlRef.current);
      currentPhotoUrlRef.current = null;
    }
    if (photoUploadRef.current) {
      photoUploadRef.current.value = "";
    }
    setPhotoSrc("");
    setHasPhoto(false);
    setRemoveBgQualityUsed(null);
    setRemoveBgQuality("standard");
    setRemoveBgBusy(false);
    setRemoveBgMessage("");
    setOffsetX(0);
    setOffsetY(0);
  }, []);

  const removeBackground = useCallback(
    async (quality: BackgroundRemovalQuality = "standard") => {
      if (!hasPhoto || !photoSrc) return;
      if (removeBgQualityUsed === quality) return;

      removeBgRunIdRef.current += 1;
      const runId = removeBgRunIdRef.current;
      let timeoutHandle: number | undefined;
      const isHq = quality === "hq";

      setRemoveBgBusy(true);
      setRemoveBgMessage(isHq ? "Downloading HD model..." : "");

      await new Promise<void>((r) => {
        window.setTimeout(() => r(), 0);
      });
      await new Promise<void>((r) => {
        window.requestAnimationFrame(() => r());
      });

      try {
        const processedSource = await Promise.race([
          removeBackgroundImage(photoSrc, quality),
          new Promise<string>((_, reject) => {
            timeoutHandle = window.setTimeout(() => {
              reject(new Error("Background removal timed out."));
            }, 45000);
          }),
        ]);

        if (runId !== removeBgRunIdRef.current) return;

        if (currentPhotoUrlRef.current) {
          URL.revokeObjectURL(currentPhotoUrlRef.current);
          currentPhotoUrlRef.current = null;
        }

        setPhotoSrc(processedSource);
        setRemoveBgQualityUsed(quality);
        setRemoveBgMessage(
          isHq ? "Background removed (HD)" : "Background removed",
        );
      } catch (error) {
        console.error("Error during background removal:", error);
        if (runId === removeBgRunIdRef.current) {
          setRemoveBgMessage(
            isHq
              ? "HD background removal failed."
              : "Background removal failed.",
          );
        }
      } finally {
        if (timeoutHandle) window.clearTimeout(timeoutHandle);
        if (runId === removeBgRunIdRef.current) {
          setRemoveBgBusy(false);
        }
      }
    },
    [hasPhoto, photoSrc, removeBgQualityUsed],
  );

  const exportPoster = useCallback(async () => {
    const stage = stageRef.current;
    const frameImage = frameImageRef.current;
    const photoImage = photoImageRef.current;
    const nameText = nameTextRef.current;

    if (!stage || !frameImage || !nameText) {
      console.error("Missing elements for export");
      return;
    }

    setExportBusy(true);
    setExportMessage("");

    const designationsForExport = designationLines
      .map((line, i) => ({
        originalIndex: i,
        scale: activeFrameConfig.roleText.scale * (roleScaleAdjusts[i] ?? 1),
        colorOverride: designationColors[i] ?? undefined,
        text: line,
      }))
      .filter((d) => d.text.trim().length > 0);

    try {
      await generatePoster({
        designations: designationsForExport,
        frameImage,
        fullName,
        hasOverlay: activeFrameConfig.hasOverlay,
        hasPhoto,
        nameColorOverride: nameColor ?? undefined,
        nameScale: activeFrameConfig.nameText.scale * nameScaleAdjust,
        nameText,
        overlaySrc: activeFrameConfig.overlaySrc ?? "",
        photoImage: photoImage ?? undefined,
        photoSrc,
        stage,
      });
    } catch (error) {
      console.error("Error during export:", error);
      setExportMessage("Export failed.");
    } finally {
      setExportBusy(false);
    }
  }, [
    activeFrameConfig,
    designationLines,
    fullName,
    hasPhoto,
    nameScaleAdjust,
    photoSrc,
    roleScaleAdjusts,
    designationColors,
    nameColor,
  ]);

  const addDesignation = useCallback(() => {
    if (designationLines.length >= MAX_DESIGNATIONS) return;

    setDesignationLines((prev) => [...prev, ""]);
    const newIndex = designationLines.length;
    setActiveRoleIndex(newIndex);

    const overlay = frameOverlayRef.current;
    let newX = 0;
    let newY = 0;

    if (overlay) {
      const rect = overlay.getBoundingClientRect();
      const { roleText } = activeFrameConfig;
      if (rect.width > 0 && rect.height > 0) {
        newX = (rect.width * (50 - roleText.xPct)) / 100;
      }
    }

    if (designationOffsets.length > 0) {
      newY = designationOffsets[0].y;
    }

    setDesignationOffsets((prev) => [...prev, { x: newX, y: newY }]);
    setRoleScaleAdjusts((prev) => [...prev, 1]);
    setDesignationColors((prev) => [...prev, null]);
    setDesignationTextStyles((prev) => [...prev, { ...DEFAULT_TEXT_STYLE }]);
    setSelectedTextId(newIndex);
  }, [designationLines.length, designationOffsets, activeFrameConfig]);

  const clearAll = useCallback(() => {
    if (currentPhotoUrlRef.current) {
      URL.revokeObjectURL(currentPhotoUrlRef.current);
      currentPhotoUrlRef.current = null;
    }
    if (photoUploadRef.current) {
      photoUploadRef.current.value = "";
    }
    removeBgRunIdRef.current += 1;
    nameOffsetsByFrameRef.current = {};
    roleOffsetsByFrameRef.current = {};

    setPhotoSrc("");
    setHasPhoto(false);
    setOffsetX(0);
    setOffsetY(0);
    setScale(1);
    setRemoveBgQualityUsed(null);
    setRemoveBgQuality("standard");
    setRemoveBgBusy(false);
    setRemoveBgMessage("");
    setExportMessage("");
    setFullName("");
    setDesignationLines([""]);
    setDesignationOffsets([{ x: 0, y: 0 }]);
    setActiveRoleIndex(0);
    setNameScaleAdjust(1);
    setRoleScaleAdjusts([1]);
    setNameColor(null);
    setDesignationColors([null]);
    setNameTextStyle({ ...DEFAULT_TEXT_STYLE });
    setDesignationTextStyles([{ ...DEFAULT_TEXT_STYLE }]);
    setSelectedTextId(null);
    setNameOffsetX(0);
    setNameOffsetY(0);
  }, []);

  const photoTransformStyle = useMemo(
    () =>
      `transform: translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) scale(${scale});`,
    [offsetX, offsetY, scale],
  );

  const nameTransformStyle = useMemo(() => {
    const { nameText } = activeFrameConfig;
    const effectiveWeight = nameTextStyle.bold ? "700" : "400";
    const parts = [
      `left: ${nameText.xPct}%`,
      `top: ${nameText.yPct}%`,
      `color: ${nameText.color}`,
      `font-family: ${nameText.fontFamily}`,
      `font-size: calc(${nameText.fontSizePx} * 1em)`,
      `font-weight: ${effectiveWeight}`,
      `background-color: ${nameText.backgroundColor}`,
      "transform-origin: left top",
      `transform: translate(${nameOffsetX}px, ${nameOffsetY}px) scale(${nameText.scale * nameScaleAdjust})`,
    ];
    if (nameColor) parts.push(`color: ${nameColor}`);
    if (nameTextStyle.italic) parts.push("font-style: italic");
    return parts.join("; ");
  }, [
    activeFrameConfig,
    nameOffsetX,
    nameOffsetY,
    nameScaleAdjust,
    nameColor,
    nameTextStyle,
  ]);

  const getRoleTransformStyle = useCallback(
    (index: number) => {
      const { roleText } = activeFrameConfig;
      const offsets = designationOffsets[index] || { x: 0, y: 0 };
      const itemScale = roleScaleAdjusts[index] ?? 1;
      const itemStyle = designationTextStyles[index] ?? DEFAULT_TEXT_STYLE;
      const effectiveWeight = itemStyle.bold ? "700" : "400";
      const parts = [
        `left: ${roleText.xPct}%`,
        `top: ${roleText.yPct}%`,
        `color: ${roleText.color}`,
        `font-family: ${roleText.fontFamily}`,
        `font-size: calc(${roleText.fontSizePx} * 1em)`,
        `font-weight: ${effectiveWeight}`,
        `background-color: ${roleText.backgroundColor}`,
        "transform-origin: left top",
        `transform: translate(${offsets.x}px, ${offsets.y}px) scale(${roleText.scale * itemScale})`,
      ];
      const colorOverride = designationColors[index];
      if (colorOverride) parts.push(`color: ${colorOverride}`);
      if (itemStyle.italic) parts.push("font-style: italic");
      return parts.join("; ");
    },
    [
      activeFrameConfig,
      designationOffsets,
      roleScaleAdjusts,
      designationColors,
      designationTextStyles,
    ],
  );

  const clampDragDelta = useCallback(
    (target: HTMLElement, dx: number, dy: number) => {
      const overlay = frameOverlayRef.current;
      if (!overlay) return { dx, dy };
      const frameRect = overlay.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const minDx = frameRect.left - targetRect.left;
      const maxDx = frameRect.right - targetRect.right;
      const minDy = frameRect.top - targetRect.top;
      const maxDy = frameRect.bottom - targetRect.bottom;
      return {
        dx: Math.min(Math.max(dx, minDx), maxDx),
        dy: Math.min(Math.max(dy, minDy), maxDy),
      };
    },
    [],
  );

  const onPhotoDrag = useCallback((dx: number, dy: number) => {
    setOffsetX((prev) => prev + dx);
    setOffsetY((prev) => prev + dy);
  }, []);

  const onNameDrag = useCallback((dx: number, dy: number) => {
    setNameOffsetX((prev) => prev + dx);
    setNameOffsetY((prev) => prev + dy);
  }, []);

  const onRoleDrag = useCallback((index: number, dx: number, dy: number) => {
    setDesignationOffsets((prev) =>
      prev.map((o, i) => (i === index ? { x: o.x + dx, y: o.y + dy } : o)),
    );
  }, []);

  return {
    activeFrame,
    activeFrameConfig,
    activeRoleIndex,
    activeRoleInputRef,
    addDesignation,
    adjustNameScale,
    adjustRoleScale,
    clampDragDelta,
    clearAll,
    clearPhoto,
    designationColors,
    designationLines,
    designationOffsets,
    designationTextStyles,
    exportBusy,
    exportMessage,
    exportPoster,
    filteredFrames,
    frameImageRef,
    frameOverlayRef,
    fullName,
    fullNameInputRef,
    getRoleTransformStyle,
    hasPhoto,
    maxDesignations: MAX_DESIGNATIONS,
    nameColor,
    nameOffsetX,
    nameTextStyle,
    nameOffsetY,
    nameScaleAdjust,
    nameTextRef,
    nameTransformStyle,
    offsetX,
    offsetY,
    onNameDrag,
    onPhotoDrag,
    onPhotoFileChange,
    onRoleDrag,
    photoImageRef,
    photoSrc,
    photoTransformStyle,
    photoUploadRef,
    removeBackground,
    removeBgBusy,
    removeBgMessage,
    removeBgQuality,
    roleScaleAdjusts,
    saveActiveTextOffsets,
    scale,
    selectedCategory,
    setActiveRoleIndex,
    setCategoryFn,
    selectedTextId,
    setDesignationColors,
    setDesignationLines,
    setDesignationTextStyles,
    setFrameFn,
    setFullName,
    setNameColor,
    setNameTextStyle,
    setRemoveBgQuality,
    setSelectedTextId,
    setScale,
    stageRef,
    updateFrameOverlay,
  };
}
