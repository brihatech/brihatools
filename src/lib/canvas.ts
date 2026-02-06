import { getOrientedDimensions } from "./image";

/**
 * Creates an ImageBitmap with EXIF orientation already applied.
 * This allows for faster subsequent draws.
 */
export async function createOrientedBitmap(
  source: HTMLImageElement | Blob | File,
  orientation: number,
): Promise<ImageBitmap> {
  let img: HTMLImageElement | ImageBitmap;

  if (source instanceof HTMLImageElement) {
    img = source;
  } else {
    img = await createImageBitmap(source);
  }

  const { width, height } = getOrientedDimensions(img, orientation);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;

  if (!ctx) throw new Error("Could not get context for OffscreenCanvas");

  drawOrientedImage(ctx, img, orientation, 0, 0, width, height);

  return canvas.transferToImageBitmap();
}

/**
 * Draws an image onto a canvas context with EXIF rotation corrections applied
 * without using temporary canvases, maximizing performance.
 */
export function drawOrientedImage(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  orientation: number,
  destX: number,
  destY: number,
  destWidth: number,
  destHeight: number,
) {
  ctx.save();
  // ... rest of the logic

  // Move to the center of the destination area to simplify transformations
  const centerX = destX + destWidth / 2;
  const centerY = destY + destHeight / 2;
  ctx.translate(centerX, centerY);

  switch (orientation) {
    case 2: // Flip horizontal
      ctx.scale(-1, 1);
      break;
    case 3: // Rotate 180
      ctx.rotate(Math.PI);
      break;
    case 4: // Flip vertical
      ctx.scale(1, -1);
      break;
    case 5: // Transpose (rotate 90 CW and flip horizontal)
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      break;
    case 6: // Rotate 90 CW
      ctx.rotate(Math.PI / 2);
      break;
    case 7: // Transverse (rotate 90 CW and flip vertical)
      ctx.rotate(Math.PI / 2);
      ctx.scale(-1, 1);
      break;
    case 8: // Rotate 270 CW
      ctx.rotate(-Math.PI / 2);
      break;
  }

  // Draw image centered at the translated origin
  // If orientation is 5-8, the width and height are swapped in the transformation matrix context
  const isRotated = orientation >= 5 && orientation <= 8;
  const drawWidth = isRotated ? destHeight : destWidth;
  const drawHeight = isRotated ? destWidth : destHeight;

  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

  ctx.restore();
}
