import { useCallback, useEffect, useRef, useState } from "react";
import { sileo } from "sileo";

import type { BackgroundRemovalQuality } from "@/lib/bg-removal/client";
import { useBackgroundRemoval } from "@/hooks/use-background-removal";
import { logError } from "@/lib/logger";

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
  removeBgBusy: boolean;
  removeBgQuality: BackgroundRemovalQuality;
}

async function loadAvailableFrames(): Promise<FrameInfo[]> {
  return Promise.all(
    FB_FRAMES.map(async (frame) => {
      const img = new Image();
      img.src = frame.src;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });

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
    removeBgBusy: false,
    removeBgQuality: "standard",
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoImageRef = useRef<HTMLImageElement | null>(null);
  const frameImageRef = useRef<HTMLImageElement | null>(null);

  // Track current photo URL for cleanup
  const currentPhotoUrlRef = useRef<string | null>(null);

  const {
    processedImage,
    isProcessing: isRemoveBgProcessing,
    removeBg: triggerRemoveBg,
    cleanup: cleanupBgRemoval,
  } = useBackgroundRemoval();

  useEffect(() => {
    loadAvailableFrames().then((frames) => {
      setState((prev) => ({
        ...prev,
        frames,
        selectedFrame: frames[0] ?? null,
      }));
    });
  }, []);

  // Update busy state from hook
  useEffect(() => {
    setState((prev) => ({ ...prev, removeBgBusy: isRemoveBgProcessing }));
  }, [isRemoveBgProcessing]);

  // When background is removed, update the photo URL
  useEffect(() => {
    if (processedImage) {
      // If we have a processed image, use it
      setState((prev) => ({
        ...prev,
        photoUrl: processedImage,
        // We might want to update natural dimensions here too if the crop changed,
        // but BG removal usually keeps dimensions or at least aspect ratio if mask is applied to original.
        // The worker returns a blob which is the original image with mask applied.
      }));
    }
  }, [processedImage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentPhotoUrlRef.current) {
        URL.revokeObjectURL(currentPhotoUrlRef.current);
      }
    };
  }, []);

  const selectFrame = useCallback((frame: FrameInfo) => {
    setState((prev) => ({ ...prev, selectedFrame: frame }));
  }, []);

  const onPhotoChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Cleanup previous manually created URL
      if (currentPhotoUrlRef.current) {
        URL.revokeObjectURL(currentPhotoUrlRef.current);
        currentPhotoUrlRef.current = null;
      }

      // Cleanup any background removal result
      cleanupBgRemoval();

      const url = URL.createObjectURL(file);
      currentPhotoUrlRef.current = url;

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
          removeBgBusy: false,
          removeBgQuality: "standard",
        }));
      };
      img.src = url;
    },
    [cleanupBgRemoval],
  );

  const clearPhoto = useCallback(() => {
    if (currentPhotoUrlRef.current) {
      URL.revokeObjectURL(currentPhotoUrlRef.current);
      currentPhotoUrlRef.current = null;
    }
    cleanupBgRemoval();

    setState((prev) => ({
      ...prev,
      photoFile: null,
      photoUrl: null,
      photoNaturalWidth: 0,
      photoNaturalHeight: 0,
      scale: 1,
      pan: { x: 0, y: 0 },
      removeBgBusy: false,
      removeBgQuality: "standard",
    }));
  }, [cleanupBgRemoval]);

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

  const setRemoveBgQuality = useCallback(
    (quality: BackgroundRemovalQuality) => {
      setState((prev) => ({ ...prev, removeBgQuality: quality }));
    },
    [],
  );

  const removeBackground = useCallback(async () => {
    const { photoUrl, removeBgQuality } = state;
    if (!photoUrl) return;

    try {
      await triggerRemoveBg(photoUrl, removeBgQuality);
      sileo.success({
        title: "Background Removed",
        description: "Background has been successfully removed.",
      });
    } catch (error) {
      logError("fb_frame.background.remove_failed", error, {
        feature: "fb-frame",
        quality: removeBgQuality,
      });
      sileo.error({
        title: "Removal Failed",
        description: "Could not remove background. Please try again.",
      });
    }
  }, [state, triggerRemoveBg]);

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
      photoImg.crossOrigin = "anonymous"; // Important if photoUrl is blob from worker? Blobs are same-origin usually.
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

      sileo.success({
        title: "Export Complete",
        description: "Framed profile photo downloaded as JPG.",
      });
    } catch (error) {
      logError("fb_frame.export.failed", error, {
        feature: "fb-frame",
      });
      sileo.error({
        title: "Export Failed",
        description: "Couldn’t generate the framed JPG. Please try again.",
      });
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
    removeBgBusy: state.removeBgBusy,
    removeBgQuality: state.removeBgQuality,
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
    removeBackground,
    setRemoveBgQuality,
    canvasRef,
    photoImageRef,
    frameImageRef,
  };
}
