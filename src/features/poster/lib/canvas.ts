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
  fontStyle: string;
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
    fontStyle: style.fontStyle || "normal",
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

export type PosterConfig = {
  stage: HTMLDivElement;
  frameImage: HTMLImageElement;
  photoImage?: HTMLImageElement;
  nameText: HTMLElement;
  fullName: string;
  designations: {
    text: string;
    originalIndex: number;
    scale: number;
    colorOverride?: string;
    bgColorOverride?: string;
  }[];
  nameScale: number;
  nameColorOverride?: string;
  nameBgColorOverride?: string;
  hasOverlay: boolean;
  overlaySrc: string;
  hasPhoto: boolean;
  photoSrc: string;
};

export async function generatePoster(config: PosterConfig) {
  const {
    stage,
    frameImage,
    photoImage,
    nameText,
    fullName,
    designations,
    nameScale,
    hasOverlay,
    overlaySrc,
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

  // Use the actual frame overlay DOM rect for accurate mapping.
  // This avoids border-box vs content-box mismatches and timing issues.
  const overlayEl = document.getElementById("frameOverlay");
  let frameRectStage: Rect;
  if (overlayEl) {
    const oRect = overlayEl.getBoundingClientRect();
    frameRectStage = {
      x: oRect.left - stageRect.left,
      y: oRect.top - stageRect.top,
      width: oRect.width,
      height: oRect.height,
    };
  } else {
    frameRectStage = computeContainedRect(
      stageRect.width,
      stageRect.height,
      frameImage.naturalWidth,
      frameImage.naturalHeight,
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = frameImage.naturalWidth;
  canvas.height = frameImage.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas context.");
  }

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

  // Photo: read actual DOM position instead of recomputing from offsets
  if (hasPhoto && photoImage && photoSrc) {
    const photoContainer = photoImage.parentElement;
    if (photoContainer) {
      const pRect = photoContainer.getBoundingClientRect();
      const centerXStage = pRect.left + pRect.width / 2 - stageRect.left;
      const centerYStage = pRect.top + pRect.height / 2 - stageRect.top;

      const centerXFrame = (centerXStage - frameRectStage.x) * sx;
      const centerYFrame = (centerYStage - frameRectStage.y) * sy;
      const widthFrame = pRect.width * sx;
      const heightFrame = pRect.height * sy;

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

    const fontStylePrefix = pill.fontStyle === "italic" ? "italic " : "";
    ctx.font = `${fontStylePrefix}${pill.fontWeight} ${fontSize}px ${pill.fontFamily}`;
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
      fontSize,
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

  // Text: read actual DOM positions for accurate placement
  if (safeName) {
    const nameStyle = getPillStyle(nameText);
    if (config.nameColorOverride)
      nameStyle.textColor = config.nameColorOverride;
    if (config.nameBgColorOverride)
      nameStyle.backgroundColor = config.nameBgColorOverride;
    const nameSpec = makePillSpec(safeName, nameStyle, nameScale);
    const nRect = nameText.getBoundingClientRect();
    const nameX = (nRect.left - stageRect.left - frameRectStage.x) * sx;
    const nameY = (nRect.top - stageRect.top - frameRectStage.y) * sy;
    drawPill(nameSpec, nameX, nameY);
  }

  if (designations && designations.length > 0) {
    for (const des of designations) {
      const text = des.text.trim();
      if (!text) continue;

      const roleEl = document.getElementById(`roleText-${des.originalIndex}`);
      if (!roleEl) continue;

      const desStyle = getPillStyle(roleEl);
      if (des.colorOverride) desStyle.textColor = des.colorOverride;
      if (des.bgColorOverride) desStyle.backgroundColor = des.bgColorOverride;

      const roleSpec = makePillSpec(text, desStyle, des.scale);
      const rRect = roleEl.getBoundingClientRect();
      const roleX = (rRect.left - stageRect.left - frameRectStage.x) * sx;
      const roleY = (rRect.top - stageRect.top - frameRectStage.y) * sy;
      drawPill(roleSpec, roleX, roleY);
    }
  }

  await downloadCanvasPng(canvas, "poster.png");
}
