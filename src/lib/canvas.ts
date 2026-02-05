import { getOrientedDimensions } from "./image";
/**
 * Draws an image onto a canvas context with EXIF rotation corrections applied.
 */
export function drawOrientedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  orientation: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const tempCanvas = document.createElement("canvas");
  const { width: orientedWidth, height: orientedHeight } =
    getOrientedDimensions(image, orientation);
  tempCanvas.width = orientedWidth;
  tempCanvas.height = orientedHeight;
  const tempCtx = tempCanvas.getContext("2d") as CanvasRenderingContext2D;

  switch (orientation) {
    case 2:
      tempCtx.translate(orientedWidth, 0);
      tempCtx.scale(-1, 1);
      break;
    case 3:
      tempCtx.translate(orientedWidth, orientedHeight);
      tempCtx.rotate(Math.PI);
      break;
    case 4:
      tempCtx.translate(0, orientedHeight);
      tempCtx.scale(1, -1);
      break;
    case 5:
      tempCtx.rotate(0.5 * Math.PI);
      tempCtx.scale(1, -1);
      break;
    case 6:
      tempCtx.translate(orientedWidth, 0);
      tempCtx.rotate(Math.PI / 2);
      break;
    case 7:
      tempCtx.translate(orientedWidth, orientedHeight);
      tempCtx.rotate(Math.PI / 2);
      tempCtx.scale(-1, 1);
      break;
    case 8:
      tempCtx.translate(0, orientedHeight);
      tempCtx.rotate(-Math.PI / 2);
      break;
    default:
      break;
  }

  tempCtx.drawImage(image, 0, 0);
  ctx.drawImage(tempCanvas, x, y, width, height);
}
