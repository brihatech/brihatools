export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PillStyle = {
  fontFamily: string;
  fontSizePx: number;
  fontWeight: string;
  textColor: string;
  backgroundColor: string;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  borderRadius: number;
};

export const parsePx = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const computeContainedRect = (
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): Rect => {
  const imageRatio = imageWidth / imageHeight;
  const containerRatio = containerWidth / containerHeight;

  let drawWidth = containerWidth;
  let drawHeight = containerHeight;
  let x = 0;
  let y = 0;

  if (containerRatio > imageRatio) {
    drawHeight = containerHeight;
    drawWidth = drawHeight * imageRatio;
    x = (containerWidth - drawWidth) / 2;
  } else {
    drawWidth = containerWidth;
    drawHeight = drawWidth / imageRatio;
    y = (containerHeight - drawHeight) / 2;
  }

  return { x, y, width: drawWidth, height: drawHeight };
};

export const getPillStyle = (element: HTMLElement): PillStyle => {
  const style = getComputedStyle(element);
  return {
    fontFamily: style.fontFamily || "system-ui",
    fontSizePx: parsePx(style.fontSize),
    fontWeight: style.fontWeight || "600",
    textColor: style.color || "#0f172a",
    backgroundColor: style.backgroundColor || "rgba(255,255,255,0.8)",
    paddingLeft: parsePx(style.paddingLeft),
    paddingRight: parsePx(style.paddingRight),
    paddingTop: parsePx(style.paddingTop),
    paddingBottom: parsePx(style.paddingBottom),
    borderRadius: parsePx(style.borderRadius),
  };
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

const downloadCanvasPng = async (canvas: HTMLCanvasElement, name: string) => {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) {
          reject(new Error("Failed to create PNG blob"));
          return;
        }
        resolve(b);
      },
      "image/png",
      1,
    );
  });

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.download = name;
    link.href = url;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
};

const PHOTO_BASE_WIDTH_FRACTION = 0.35;
export type PosterConfig = {
  stage: HTMLDivElement;
  frameImage: HTMLImageElement;
  photoImage?: HTMLImageElement;
  nameText: HTMLElement;
  roleText: HTMLElement;
  fullName: string;
  designation: string;
  nameBaseXPct: number;
  nameBaseYPct: number;
  roleBaseXPct: number;
  roleBaseYPct: number;
  nameScale: number;
  roleScale: number;
  hasOverlay: boolean;
  overlaySrc: string;
  nameOffsetX: number;
  nameOffsetY: number;
  roleOffsetX: number;
  roleOffsetY: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  hasPhoto: boolean;
  photoSrc: string;
};

export async function generatePoster(config: PosterConfig) {
  const {
    stage,
    frameImage,
    photoImage,
    nameText,
    roleText,
    fullName,
    designation,
    nameBaseXPct,
    nameBaseYPct,
    roleBaseXPct,
    roleBaseYPct,
    nameScale,
    roleScale,
    hasOverlay,
    overlaySrc,
    nameOffsetX,
    nameOffsetY,
    roleOffsetX,
    roleOffsetY,
    offsetX,
    offsetY,
    scale,
    hasPhoto,
    photoSrc,
  } = config;

  await frameImage.decode();
  if (hasPhoto && photoImage && photoSrc) {
    await photoImage.decode();
  }

  const stageRect = stage.getBoundingClientRect();
  if (stageRect.width <= 0 || stageRect.height <= 0) {
    throw new Error("Stage has no size");
  }

  if (!frameImage.naturalWidth || !frameImage.naturalHeight) {
    throw new Error("Frame image not ready");
  }

  const frameRectStage = computeContainedRect(
    stageRect.width,
    stageRect.height,
    frameImage.naturalWidth,
    frameImage.naturalHeight,
  );

  const exportScale = 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(frameImage.naturalWidth * exportScale);
  canvas.height = Math.round(frameImage.naturalHeight * exportScale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas context.");
  }

  ctx.setTransform(exportScale, 0, 0, exportScale, 0, 0);
  ctx.clearRect(0, 0, frameImage.naturalWidth, frameImage.naturalHeight);

  ctx.drawImage(
    frameImage,
    0,
    0,
    frameImage.naturalWidth,
    frameImage.naturalHeight,
  );

  const sx = frameImage.naturalWidth / frameRectStage.width;
  const sy = frameImage.naturalHeight / frameRectStage.height;

  if (hasPhoto && photoImage && photoSrc) {
    const photoNaturalWidth = photoImage.naturalWidth;
    const photoNaturalHeight = photoImage.naturalHeight;

    if (photoNaturalWidth > 0 && photoNaturalHeight > 0) {
      const stageCenterX = stageRect.width / 2 + offsetX;
      const stageCenterY = stageRect.height / 2 + offsetY;

      const centerXFrame = (stageCenterX - frameRectStage.x) * sx;
      const centerYFrame = (stageCenterY - frameRectStage.y) * sy;

      const baseWidthStage = PHOTO_BASE_WIDTH_FRACTION * stageRect.width;
      const widthStage = baseWidthStage * scale;
      const widthFrame = widthStage * sx;
      const heightFrame = widthFrame * (photoNaturalHeight / photoNaturalWidth);

      ctx.drawImage(
        photoImage,
        centerXFrame - widthFrame / 2,
        centerYFrame - heightFrame / 2,
        widthFrame,
        heightFrame,
      );
    }
  }

  const frameW = frameImage.naturalWidth;
  const frameH = frameImage.naturalHeight;

  const safeName = fullName.trim();
  const safeRole = designation.trim();

  const makePillSpec = (text: string, pill: PillStyle, scale: number) => {
    const upperText = text.toUpperCase();
    const fontSize = pill.fontSizePx * sy * scale;
    const padL = pill.paddingLeft * sx * scale;
    const padR = pill.paddingRight * sx * scale;
    const padT = pill.paddingTop * sy * scale;
    const padB = pill.paddingBottom * sy * scale;

    ctx.font = `${pill.fontWeight} ${fontSize}px ${pill.fontFamily}`;
    ctx.textBaseline = "top";
    const metrics = ctx.measureText(upperText);

    const width = metrics.width + padL + padR;
    const height = fontSize + padT + padB;
    const radius = Math.min((pill.borderRadius || height / 2) * sy, height / 2);

    return {
      text: upperText,
      font: ctx.font,
      width,
      height,
      radius,
      padL,
      padT,
      textColor: pill.textColor,
      backgroundColor: pill.backgroundColor,
    };
  };

  const drawPill = (
    spec: ReturnType<typeof makePillSpec>,
    x: number,
    y: number,
  ) => {
    ctx.save();
    ctx.font = spec.font;
    ctx.textBaseline = "top";
    ctx.fillStyle = spec.backgroundColor;
    drawRoundedRect(ctx, x, y, spec.width, spec.height, spec.radius);
    ctx.fill();
    ctx.fillStyle = spec.textColor;
    ctx.fillText(spec.text, x + spec.padL, y + spec.padT);
    ctx.restore();
  };

  if (hasOverlay && overlaySrc) {
    const overlayImage = new Image();
    overlayImage.src = overlaySrc;
    await overlayImage.decode();
    ctx.drawImage(overlayImage, 0, 0, frameW, frameH);
  }

  if (safeName) {
    const nameSpec = makePillSpec(safeName, getPillStyle(nameText), nameScale);
    const nameX = (nameBaseXPct / 100) * frameW + nameOffsetX * sx;
    const nameY = (nameBaseYPct / 100) * frameH + nameOffsetY * sy;
    drawPill(nameSpec, nameX, nameY);
  }

  if (safeRole) {
    const roleSpec = makePillSpec(safeRole, getPillStyle(roleText), roleScale);
    const roleX = (roleBaseXPct / 100) * frameW + roleOffsetX * sx;
    const roleY = (roleBaseYPct / 100) * frameH + roleOffsetY * sy;
    drawPill(roleSpec, roleX, roleY);
  }

  await downloadCanvasPng(canvas, "poster.png");
}
