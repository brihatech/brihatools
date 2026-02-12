export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PillStyle = {
  fontFamily: string;
  fontSizePx: number;
  lineHeightPx: number;
  fontWeight: string;
  letterSpacingPx: number;
  textTransform: string;
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

const applyTextTransform = (text: string, transform: string) => {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/\b\w/g, (char) => char.toUpperCase());
    default:
      return text;
  }
};

const hasNonAscii = (value: string) => /[^\p{ASCII}]/u.test(value);

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
  const fontSizePx = parsePx(style.fontSize);
  const lineHeightPx = parsePx(style.lineHeight);
  const resolvedLineHeight = lineHeightPx > 0 ? lineHeightPx : fontSizePx * 1.2;
  return {
    fontFamily: style.fontFamily || "system-ui",
    fontSizePx,
    lineHeightPx: resolvedLineHeight,
    fontWeight: style.fontWeight || "600",
    letterSpacingPx: parsePx(style.letterSpacing),
    textTransform: style.textTransform || "none",
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
  designations: {
    text: string;
    offsetX: number;
    offsetY: number;
  }[];
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
    designations,
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

  const makePillSpec = (text: string, pill: PillStyle, scale: number) => {
    const transformed = applyTextTransform(text, pill.textTransform);
    const lines = transformed.split(/\r?\n/);
    const fontSize = pill.fontSizePx * sy * scale;
    const lineHeight = pill.lineHeightPx * sy * scale;
    const padL = pill.paddingLeft * sx * scale;
    const padR = pill.paddingRight * sx * scale;
    const padT = pill.paddingTop * sy * scale;
    const padB = pill.paddingBottom * sy * scale;
    const letterSpacing = pill.letterSpacingPx * sx * scale;
    const allowLetterSpacing = letterSpacing > 0 && !lines.some(hasNonAscii);

    ctx.font = `${pill.fontWeight} ${fontSize}px ${pill.fontFamily}`;
    ctx.textBaseline = "top";
    let maxTextWidth = 0;
    for (const line of lines) {
      if (allowLetterSpacing && line.length > 1) {
        let lineWidth = 0;
        for (const char of line) {
          lineWidth += ctx.measureText(char).width;
        }
        lineWidth += letterSpacing * (line.length - 1);
        maxTextWidth = Math.max(maxTextWidth, lineWidth);
      } else {
        const metrics = ctx.measureText(line);
        maxTextWidth = Math.max(maxTextWidth, metrics.width);
      }
    }

    const width = maxTextWidth + padL + padR;
    const height = lineHeight * lines.length + padT + padB;
    const radius = Math.min((pill.borderRadius || height / 2) * sy, height / 2);
    // DOM renders text centered in the line-height (half-leading on top and bottom).
    // Canvas textBaseline="top" draws from the top of the em-box.
    // We need to push the text down by the half-leading.
    const halfLeading = (lineHeight - fontSize) / 2;

    return {
      lines,
      font: ctx.font,
      width,
      height,
      radius,
      padL,
      padT,
      letterSpacing: allowLetterSpacing ? letterSpacing : 0,
      lineHeight,
      halfLeading,
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
    spec.lines.forEach((line, index) => {
      const drawY = y + spec.padT + index * spec.lineHeight + spec.halfLeading;
      if (spec.letterSpacing > 0 && line.length > 1) {
        let cursorX = x + spec.padL;
        for (const char of line) {
          ctx.fillText(char, cursorX, drawY);
          cursorX += ctx.measureText(char).width + spec.letterSpacing;
        }
      } else {
        ctx.fillText(line, x + spec.padL, drawY);
      }
    });
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

  if (designations && designations.length > 0) {
    const baseRoleStyle = getPillStyle(roleText);

    for (const des of designations) {
      const text = des.text.trim();
      if (!text) continue;

      const roleSpec = makePillSpec(text, baseRoleStyle, roleScale);
      const roleX = (roleBaseXPct / 100) * frameW + des.offsetX * sx;
      const roleY = (roleBaseYPct / 100) * frameH + des.offsetY * sy;
      drawPill(roleSpec, roleX, roleY);
    }
  }

  await downloadCanvasPng(canvas, "poster.png");
}
