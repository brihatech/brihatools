import JSZip from "jszip";

import { drawOrientedImage } from "./lib/canvas";
import {
  calculateTargetSize,
  type Dimensions,
  getOrientedDimensions,
  type OrientationType,
} from "./lib/image";

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
}

self.onmessage = async (e: MessageEvent<RenderJob>) => {
  const { frame, photos, settings } = e.data;
  const zip = new JSZip();

  const canvas = new OffscreenCanvas(frame.width, frame.height);
  const ctx = canvas.getContext("2d")!;

  const frameDims: Dimensions = { width: frame.width, height: frame.height };

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

    const { width: targetWidth, height: targetHeight } = calculateTargetSize(
      frameDims,
      orientedDims,
      currentSettings.scale,
      orientationType,
    );

    const centerX = (frameDims.width - targetWidth) / 2;
    const centerY = (frameDims.height - targetHeight) / 2;
    const offsetValue = currentSettings.offset * frameDims.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(frame, 0, 0);

    drawOrientedImage(
      ctx,
      photo.bitmap,
      photo.orientation,
      centerX,
      centerY + offsetValue,
      targetWidth,
      targetHeight,
    );

    const blob = await canvas.convertToBlob({ type: "image/png" });
    zip.file(`${photo.name.replace(/\.[^/.]+$/, "")}-framed.png`, blob);

    // Close the bitmap to free memory
    photo.bitmap.close();
  }

  // Close frame bitmap
  frame.close();

  const content = await zip.generateAsync({ type: "blob" });
  self.postMessage({ type: "complete", blob: content });
};
