import JSZip from "jszip";

import { drawOrientedImage } from "../lib/canvas";
import {
  calculateTargetSize,
  type Dimensions,
  getOrientedDimensions,
  type OrientationType,
} from "../lib/image";

interface RenderJob {
  frame: ImageBitmap;
  photos: Array<{
    name: string;
    bitmap: ImageBitmap;
    orientation: number;
  }>;
  settings: {
    portrait: { scale: number; offset: number };
    landscape: { scale: number; offset: number };
  };
  exportScale: number;
}

self.onmessage = async (e: MessageEvent<RenderJob>) => {
  const { frame, photos, settings, exportScale } = e.data;

  const zip = new JSZip();

  // Start with a tiny canvas – we will resize per photo
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext("2d")!;

  const frameDims: Dimensions = {
    width: frame.width,
    height: frame.height,
  };

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];

    // Progress update
    self.postMessage({
      type: "progress",
      current: i + 1,
      total: photos.length,
    });

    const orientedDims = getOrientedDimensions(photo.bitmap, photo.orientation);

    const orientationType: OrientationType =
      orientedDims.height > orientedDims.width ? "portrait" : "landscape";

    const currentSettings = settings[orientationType];

    // Layout math in FRAME SPACE (unchanged)
    const { width: targetWidth, height: targetHeight } = calculateTargetSize(
      frameDims,
      orientedDims,
      currentSettings.scale,
      orientationType,
    );

    const centerX = (frameDims.width - targetWidth) / 2;
    const centerY = (frameDims.height - targetHeight) / 2;
    const offsetValue = currentSettings.offset * frameDims.height;

    // Resize canvas to final export resolution
    canvas.width = Math.round(frameDims.width * exportScale);
    canvas.height = Math.round(frameDims.height * exportScale);

    // Reset + scale context
    ctx.setTransform(exportScale, 0, 0, exportScale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Clear in FRAME SPACE (not canvas space!)
    ctx.clearRect(0, 0, frameDims.width, frameDims.height);

    // Draw frame (scaled up automatically)
    ctx.drawImage(frame, 0, 0);

    // Draw photo (never downscaled)
    drawOrientedImage(
      ctx,
      photo.bitmap,
      photo.orientation,
      centerX,
      centerY + offsetValue,
      targetWidth,
      targetHeight,
    );

    // Export
    const blob = await canvas.convertToBlob({
      type: "image/png",
      quality: 1,
    });

    zip.file(`${photo.name.replace(/\.[^/.]+$/, "")}-framed.png`, blob);

    // Free memory
    photo.bitmap.close();
  }

  // Free frame bitmap
  frame.close();

  const content = await zip.generateAsync({ type: "blob" });

  self.postMessage({
    type: "complete",
    blob: content,
  });
};
