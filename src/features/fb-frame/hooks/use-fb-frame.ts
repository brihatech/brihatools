import { useCallback, useEffect, useRef, useState } from "react";

import { FB_FRAMES, type FbFrame } from "../lib/frames";

export type FrameInfo = FbFrame & { aspectRatio: number };

interface FbFrameState {
  frames: FrameInfo[];
  selectedFrame: FrameInfo | null;
  photoFile: File | null;
  photoUrl: string | null;
  photoNaturalWidth: number;
  photoNaturalHeight: number;
  scale: number;
  pan: { x: number; y: number };
  isExporting: boolean;
}

async function loadAvailableFrames(): Promise<FrameInfo[]> {
  return Promise.all(
    FB_FRAMES.map(async (frame) => {
      // Preload image to check if it exists and double check dimensions if needed,
      // but trust the metadata primarily for display names.
      const img = new Image();
      img.src = frame.src;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });

      // Use natural dimensions if available, otherwise fallback to metadata default
      const width = img.naturalWidth || frame.width;
      const height = img.naturalHeight || frame.height;

      return {
        ...frame,
        width,
        height,
        aspectRatio: width / height,
      };
    }),
  );
}

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 5;

export function useFbFrame() {
  const [state, setState] = useState<FbFrameState>({
    frames: [],
    selectedFrame: null,
    photoFile: null,
    photoUrl: null,
    photoNaturalWidth: 0,
    photoNaturalHeight: 0,
    scale: 1,
    pan: { x: 0, y: 0 },
    isExporting: false,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoImageRef = useRef<HTMLImageElement | null>(null);
  const frameImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    loadAvailableFrames().then((frames) => {
      setState((prev) => ({
        ...prev,
        frames,
        selectedFrame: frames[0] ?? null,
      }));
    });
  }, []);

  useEffect(() => {
    return () => {
      if (state.photoUrl) {
        URL.revokeObjectURL(state.photoUrl);
      }
    };
  }, [state.photoUrl]);

  const selectFrame = useCallback((frame: FrameInfo) => {
    setState((prev) => ({ ...prev, selectedFrame: frame }));
  }, []);

  const onPhotoChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (state.photoUrl) {
        URL.revokeObjectURL(state.photoUrl);
      }

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setState((prev) => ({
          ...prev,
          photoFile: file,
          photoUrl: url,
          photoNaturalWidth: img.naturalWidth,
          photoNaturalHeight: img.naturalHeight,
          scale: 1,
          pan: { x: 0, y: 0 },
        }));
      };
      img.src = url;
    },
    [state.photoUrl],
  );

  const clearPhoto = useCallback(() => {
    if (state.photoUrl) {
      URL.revokeObjectURL(state.photoUrl);
    }
    setState((prev) => ({
      ...prev,
      photoFile: null,
      photoUrl: null,
      photoNaturalWidth: 0,
      photoNaturalHeight: 0,
      scale: 1,
      pan: { x: 0, y: 0 },
    }));
  }, [state.photoUrl]);

  const setScale = useCallback((scale: number) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    setState((prev) => ({ ...prev, scale: clamped }));
  }, []);

  const setPan = useCallback((pan: { x: number; y: number }) => {
    setState((prev) => ({ ...prev, pan }));
  }, []);

  const resetTransform = useCallback(() => {
    setState((prev) => ({ ...prev, scale: 1, pan: { x: 0, y: 0 } }));
  }, []);

  const exportImage = useCallback(async () => {
    const { selectedFrame, photoUrl, scale, pan } = state;
    if (!selectedFrame || !photoUrl) return;

    setState((prev) => ({ ...prev, isExporting: true }));

    try {
      const frameImg = new Image();
      frameImg.crossOrigin = "anonymous";
      frameImg.src = selectedFrame.src;
      await new Promise<void>((resolve, reject) => {
        frameImg.onload = () => resolve();
        frameImg.onerror = reject;
      });

      const photoImg = new Image();
      photoImg.src = photoUrl;
      await new Promise<void>((resolve, reject) => {
        photoImg.onload = () => resolve();
        photoImg.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = frameImg.naturalWidth;
      canvas.height = frameImg.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      const frameW = canvas.width;
      const frameH = canvas.height;
      const photoW = photoImg.naturalWidth;
      const photoH = photoImg.naturalHeight;

      const frameAspect = frameW / frameH;
      const photoAspect = photoW / photoH;

      let drawW: number;
      let drawH: number;
      if (photoAspect > frameAspect) {
        drawH = frameH;
        drawW = drawH * photoAspect;
      } else {
        drawW = frameW;
        drawH = drawW / photoAspect;
      }

      drawW *= scale;
      drawH *= scale;

      const drawX = (frameW - drawW) / 2 + pan.x * frameW;
      const drawY = (frameH - drawH) / 2 + pan.y * frameH;

      ctx.drawImage(photoImg, drawX, drawY, drawW, drawH);
      ctx.drawImage(frameImg, 0, 0, frameW, frameH);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("Failed to create blob");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fb-profile-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setState((prev) => ({ ...prev, isExporting: false }));
    }
  }, [state]);

  const hasPhoto = Boolean(state.photoUrl);
  const hasFrame = Boolean(state.selectedFrame);
  const canExport = hasPhoto && hasFrame && !state.isExporting;

  return {
    frames: state.frames,
    selectedFrame: state.selectedFrame,
    photoFile: state.photoFile,
    photoUrl: state.photoUrl,
    photoNaturalWidth: state.photoNaturalWidth,
    photoNaturalHeight: state.photoNaturalHeight,
    scale: state.scale,
    pan: state.pan,
    isExporting: state.isExporting,
    hasPhoto,
    hasFrame,
    canExport,
    selectFrame,
    onPhotoChange,
    clearPhoto,
    setScale,
    setPan,
    resetTransform,
    exportImage,
    canvasRef,
    photoImageRef,
    frameImageRef,
  };
}
