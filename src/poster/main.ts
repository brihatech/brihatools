import * as ort from "onnxruntime-web";
import { getTransliterateSuggestions } from "react-transliterate";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PillStyle = {
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

const PHOTO_BASE_WIDTH_FRACTION = 0.35;
const TEXT_INSET_FRACTION = 0.08;

const parsePx = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const computeContainedRect = (
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

const getGapPx = (element: HTMLElement | null) => {
  if (!element) return 0;
  const style = getComputedStyle(element);
  return parsePx(style.rowGap || style.gap || "0");
};

const getPillStyle = (element: HTMLElement): PillStyle => {
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

const IMAGE_WIDTH = 320;
const IMAGE_HEIGHT = 320;
const IMAGE_CHANNELS = 3;
const ONNX_MODEL_PATH = "/models/u2netp.onnx";
const ONNX_PROCESSOR_PATH = "/models/output_processor.onnx";
const INPUT_TENSOR_NAME = "input.1";
const OUTPUT_TENSOR_NAME = "1959";
const OUTPUT_RESIZED_TENSOR_NAME = "output";
const MASK_TENSOR_NAME = "mask";
const ORIGINAL_SHAPE_TENSOR_NAME = "original_shape";
const NORMALIZE_MEAN = [0.485, 0.456, 0.406];
const NORMALIZE_STD = [0.229, 0.224, 0.225];

const frameButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".frame-button"),
);
const stage = document.getElementById("stage") as HTMLDivElement | null;
const frameImage = document.getElementById(
  "frameImage",
) as HTMLImageElement | null;
const photoUpload = document.getElementById(
  "photoUpload",
) as HTMLInputElement | null;
const uploadCard = document.getElementById(
  "uploadCard",
) as HTMLButtonElement | null;
const photoPreview = document.getElementById(
  "photoPreview",
) as HTMLImageElement | null;
const uploadPlaceholder = document.getElementById(
  "uploadPlaceholder",
) as HTMLDivElement | null;
const removePhotoButton = document.getElementById(
  "removePhotoButton",
) as HTMLButtonElement | null;
const photoImage = document.getElementById(
  "photoImage",
) as HTMLImageElement | null;
const scaleRange = document.getElementById(
  "scaleRange",
) as HTMLInputElement | null;
const removeBgButton = document.getElementById(
  "removeBgButton",
) as HTMLButtonElement | null;
const removeBgStatus = document.getElementById(
  "removeBgStatus",
) as HTMLSpanElement | null;
const exportButton = document.getElementById(
  "exportButton",
) as HTMLButtonElement | null;
const exportStatus = document.getElementById(
  "exportStatus",
) as HTMLSpanElement | null;
const nameInput = document.getElementById(
  "fullName",
) as HTMLInputElement | null;
const roleInput = document.getElementById(
  "designation",
) as HTMLInputElement | null;
const nameText = document.getElementById("nameText") as HTMLElement | null;
const roleText = document.getElementById("roleText") as HTMLElement | null;
const nameSuggestions = document.getElementById(
  "nameSuggestions",
) as HTMLDivElement | null;
const roleSuggestions = document.getElementById(
  "roleSuggestions",
) as HTMLDivElement | null;

if (
  frameButtons.length === 0 ||
  !stage ||
  !frameImage ||
  !photoUpload ||
  !uploadCard ||
  !photoPreview ||
  !uploadPlaceholder ||
  !removePhotoButton ||
  !photoImage ||
  !scaleRange ||
  !removeBgButton ||
  !removeBgStatus ||
  !exportButton ||
  !exportStatus ||
  !nameInput ||
  !roleInput ||
  !nameText ||
  !roleText ||
  !nameSuggestions ||
  !roleSuggestions
) {
  throw new Error("Poster builder elements are missing.");
}

let isDragging = false;
let startX = 0;
let startY = 0;
let offsetX = 0;
let offsetY = 0;
let scale = Number(scaleRange.value);
let hasPhoto = false;
let removeBgUsed = false;
let modelSessionPromise: Promise<ort.InferenceSession> | null = null;
let processorSessionPromise: Promise<ort.InferenceSession> | null = null;
let currentPhotoObjectUrl: string | null = null;

const TRANSLITERATE_LANG = "ne";
const TRANSLITERATE_DEBOUNCE_MS = 180;

ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";

const setExportLoading = (isLoading: boolean, message = "") => {
  exportButton.disabled = isLoading;
  if (isLoading) {
    exportStatus.classList.remove("hidden");
    exportStatus.textContent = "Exporting...";
    return;
  }

  if (message) {
    exportStatus.classList.remove("hidden");
    exportStatus.textContent = message;
    return;
  }

  exportStatus.classList.add("hidden");
  exportStatus.textContent = "";
};

const getStageRect = () => stage.getBoundingClientRect();

const updateFrameOverlay = () => {
  if (!frameImage.naturalWidth || !frameImage.naturalHeight) {
    return;
  }

  const stageRect = getStageRect();
  const stageWidth = stageRect.width;
  const stageHeight = stageRect.height;
  if (stageWidth <= 0 || stageHeight <= 0) {
    return;
  }

  const frameRatio = frameImage.naturalWidth / frameImage.naturalHeight;
  const stageRatio = stageWidth / stageHeight;
  let imageWidth = stageWidth;
  let imageHeight = stageHeight;
  let frameOffsetX = 0;
  let frameOffsetY = 0;

  if (stageRatio > frameRatio) {
    imageHeight = stageHeight;
    imageWidth = imageHeight * frameRatio;
    frameOffsetX = (stageWidth - imageWidth) / 2;
  } else {
    imageWidth = stageWidth;
    imageHeight = imageWidth / frameRatio;
    frameOffsetY = (stageHeight - imageHeight) / 2;
  }

  stage.style.setProperty("--frame-x", `${frameOffsetX}px`);
  stage.style.setProperty("--frame-y", `${frameOffsetY}px`);
  stage.style.setProperty("--frame-w", `${imageWidth}px`);
  stage.style.setProperty("--frame-h", `${imageHeight}px`);
};

const updateTransform = () => {
  photoImage.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
};

const applyTransform = () => {
  updateTransform();
};

const setRemoveBgLoading = (isLoading: boolean, message = "") => {
  removeBgButton.disabled = isLoading || !hasPhoto || removeBgUsed;
  if (isLoading) {
    removeBgStatus.classList.remove("hidden");
    removeBgStatus.textContent = "Removing background...";
    return;
  }

  if (message) {
    removeBgStatus.classList.remove("hidden");
    removeBgStatus.textContent = message;
    return;
  }

  removeBgStatus.classList.add("hidden");
  removeBgStatus.textContent = "";
};

const setPhotoState = (source: string) => {
  if (currentPhotoObjectUrl && source !== currentPhotoObjectUrl) {
    URL.revokeObjectURL(currentPhotoObjectUrl);
    currentPhotoObjectUrl = null;
  }

  photoImage.src = source;
  photoImage.classList.remove("hidden");
  photoPreview.src = source;
  photoPreview.classList.remove("hidden");
  uploadPlaceholder.classList.add("hidden");
  removePhotoButton.classList.remove("hidden");
  hasPhoto = true;
  removeBgUsed = false;
  setRemoveBgLoading(false);
  offsetX = 0;
  offsetY = 0;
  scale = Number(scaleRange.value);
  applyTransform();
};

const clearPhoto = () => {
  if (currentPhotoObjectUrl) {
    URL.revokeObjectURL(currentPhotoObjectUrl);
    currentPhotoObjectUrl = null;
  }

  photoUpload.value = "";
  photoImage.src = "";
  photoImage.classList.add("hidden");
  photoPreview.src = "";
  photoPreview.classList.add("hidden");
  uploadPlaceholder.classList.remove("hidden");
  removePhotoButton.classList.add("hidden");
  hasPhoto = false;
  removeBgUsed = false;
  setRemoveBgLoading(false);
  offsetX = 0;
  offsetY = 0;
  applyTransform();
};

const getModelSession = () => {
  if (!modelSessionPromise) {
    modelSessionPromise = ort.InferenceSession.create(ONNX_MODEL_PATH, {
      executionProviders: ["wasm"],
    });
  }
  return modelSessionPromise;
};

const getProcessorSession = () => {
  if (!processorSessionPromise) {
    processorSessionPromise = ort.InferenceSession.create(ONNX_PROCESSOR_PATH, {
      executionProviders: ["wasm"],
    });
  }
  return processorSessionPromise;
};

const preprocessImage = (image: HTMLImageElement) => {
  const offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = IMAGE_WIDTH;
  offscreenCanvas.height = IMAGE_HEIGHT;
  const ctx = offscreenCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas context.");
  }

  ctx.drawImage(image, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  const imageData = ctx.getImageData(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  const data = imageData.data;
  const pixels = new Float32Array(IMAGE_CHANNELS * IMAGE_WIDTH * IMAGE_HEIGHT);

  for (let y = 0; y < IMAGE_HEIGHT; y += 1) {
    for (let x = 0; x < IMAGE_WIDTH; x += 1) {
      const index = (y * IMAGE_WIDTH + x) * 4;
      const r = (data[index] / 255 - NORMALIZE_MEAN[0]) / NORMALIZE_STD[0];
      const g = (data[index + 1] / 255 - NORMALIZE_MEAN[1]) / NORMALIZE_STD[1];
      const b = (data[index + 2] / 255 - NORMALIZE_MEAN[2]) / NORMALIZE_STD[2];

      const newIndex = y * IMAGE_WIDTH + x;
      pixels[newIndex] = r;
      pixels[newIndex + IMAGE_WIDTH * IMAGE_HEIGHT] = g;
      pixels[newIndex + 2 * IMAGE_WIDTH * IMAGE_HEIGHT] = b;
    }
  }

  return new ort.Tensor("float32", pixels, [
    1,
    IMAGE_CHANNELS,
    IMAGE_WIDTH,
    IMAGE_HEIGHT,
  ]);
};

const applyMaskToImage = (
  image: HTMLImageElement,
  resizedMask: Float32Array | ort.Tensor.DataTypeMap[ort.Tensor.Type],
) => {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas context.");
  }

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, image.width, image.height);

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = (y * image.width + x) * 4;
      const maskIndex = y * image.width + x;
      imageData.data[index + 3] = 255 * Number(resizedMask[maskIndex]);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
};

const setActiveFrame = (activeButton: HTMLButtonElement) => {
  frameButtons.forEach((button) => {
    button.classList.remove(
      "border-blue-500",
      "ring-2",
      "ring-blue-500/30",
      "-translate-y-0.5",
    );
    button.classList.add("border-transparent");
  });

  activeButton.classList.add(
    "border-blue-500",
    "ring-2",
    "ring-blue-500/30",
    "-translate-y-0.5",
  );
  activeButton.classList.remove("border-transparent");
};

setActiveFrame(frameButtons[0]);

frameButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextFrame = button.getAttribute("data-frame");
    if (!nextFrame) {
      return;
    }

    setActiveFrame(button);
    frameImage.src = nextFrame;
  });
});

frameImage.addEventListener("load", updateFrameOverlay);
if (frameImage.complete) {
  updateFrameOverlay();
}

uploadCard.addEventListener("click", () => {
  photoUpload.click();
});

removePhotoButton.addEventListener("click", () => {
  clearPhoto();
});

photoUpload.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }

  if (currentPhotoObjectUrl) {
    URL.revokeObjectURL(currentPhotoObjectUrl);
  }
  currentPhotoObjectUrl = URL.createObjectURL(file);
  setPhotoState(currentPhotoObjectUrl);
});

photoImage.draggable = false;
photoImage.addEventListener("dragstart", (event) => event.preventDefault());
photoImage.addEventListener("load", () => {
  applyTransform();
});

photoImage.addEventListener("pointerdown", (event) => {
  if (!hasPhoto) {
    return;
  }

  event.preventDefault();
  isDragging = true;
  photoImage.classList.add("cursor-grabbing");
  photoImage.classList.remove("cursor-grab");
  startX = event.clientX;
  startY = event.clientY;
  photoImage.setPointerCapture(event.pointerId);
});

photoImage.addEventListener("pointermove", (event) => {
  if (!isDragging) {
    return;
  }

  const dx = event.clientX - startX;
  const dy = event.clientY - startY;
  offsetX += dx;
  offsetY += dy;
  startX = event.clientX;
  startY = event.clientY;
  applyTransform();
});

const stopDrag = (event: PointerEvent) => {
  isDragging = false;
  photoImage.classList.remove("cursor-grabbing");
  photoImage.classList.add("cursor-grab");
  if (photoImage.hasPointerCapture(event.pointerId)) {
    photoImage.releasePointerCapture(event.pointerId);
  }
};

photoImage.addEventListener("pointerup", stopDrag);
photoImage.addEventListener("pointerleave", stopDrag);
photoImage.addEventListener("pointercancel", stopDrag);

removeBgButton.addEventListener("click", async () => {
  if (!hasPhoto || !photoImage.src || removeBgUsed) {
    return;
  }

  setRemoveBgLoading(true);
  let errorMessage = "";

  try {
    const image = new Image();
    image.src = photoImage.src;
    await image.decode();

    const [modelSession, processorSession] = await Promise.all([
      getModelSession(),
      getProcessorSession(),
    ]);

    const pixelsTensor = preprocessImage(image);
    const inputDictModel = { [INPUT_TENSOR_NAME]: pixelsTensor };
    const outputModel = await modelSession.run(inputDictModel);
    const mask = outputModel[OUTPUT_TENSOR_NAME].data;

    const maskTensor = new ort.Tensor("float32", mask, [
      1,
      IMAGE_WIDTH,
      IMAGE_HEIGHT,
    ]);
    const shapeTensor = new ort.Tensor(
      "int64",
      [image.height, image.width],
      [2],
    );
    const inputDictProcessor = {
      [MASK_TENSOR_NAME]: maskTensor,
      [ORIGINAL_SHAPE_TENSOR_NAME]: shapeTensor,
    };

    const outputProcessor = await processorSession.run(inputDictProcessor);
    const resizedMask = outputProcessor[OUTPUT_RESIZED_TENSOR_NAME].data;

    const processedSource = applyMaskToImage(image, resizedMask);
    if (currentPhotoObjectUrl) {
      URL.revokeObjectURL(currentPhotoObjectUrl);
      currentPhotoObjectUrl = null;
    }
    photoImage.src = processedSource;
    photoPreview.src = processedSource;
    removeBgUsed = true;
    setRemoveBgLoading(false, "Background removed");
  } catch (error) {
    console.error("Error during background removal:", error);
    errorMessage = "Background removal failed.";
  }

  if (errorMessage) {
    setRemoveBgLoading(false, errorMessage);
  }
});

scaleRange.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement;
  scale = Number(target.value);
  applyTransform();
});

const exportPoster = async () => {
  setExportLoading(true);
  let errorMessage = "";

  try {
    await frameImage.decode();
    if (hasPhoto && photoImage.src) {
      await photoImage.decode();
    }

    const stageRect = getStageRect();
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

    // Work in frame-native coordinates, optionally upscaled.
    ctx.setTransform(exportScale, 0, 0, exportScale, 0, 0);
    ctx.clearRect(0, 0, frameImage.naturalWidth, frameImage.naturalHeight);

    // Base layer.
    ctx.drawImage(
      frameImage,
      0,
      0,
      frameImage.naturalWidth,
      frameImage.naturalHeight,
    );

    // Map stage px -> frame px.
    const sx = frameImage.naturalWidth / frameRectStage.width;
    const sy = frameImage.naturalHeight / frameRectStage.height;

    // Photo layer matches the same stage-relative transform math.
    if (hasPhoto && photoImage.src) {
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
        const heightFrame =
          widthFrame * (photoNaturalHeight / photoNaturalWidth);

        ctx.drawImage(
          photoImage,
          centerXFrame - widthFrame / 2,
          centerYFrame - heightFrame / 2,
          widthFrame,
          heightFrame,
        );
      }
    }

    // Text overlay layer.
    const frameW = frameImage.naturalWidth;
    const frameH = frameImage.naturalHeight;
    const leftInset = TEXT_INSET_FRACTION * frameW;
    const bottomInset = TEXT_INSET_FRACTION * frameH;
    const gapFrame = getGapPx(nameText.parentElement) * sy;

    const safeName = (nameInput.value || "Full Name").trim() || "Full Name";
    const safeRole = (roleInput.value || "Designation").trim() || "Designation";

    const makePillSpec = (text: string, pill: PillStyle) => {
      const upperText = text.toUpperCase();
      const fontSize = pill.fontSizePx * sy;
      const padL = pill.paddingLeft * sx;
      const padR = pill.paddingRight * sx;
      const padT = pill.paddingTop * sy;
      const padB = pill.paddingBottom * sy;

      ctx.font = `${pill.fontWeight} ${fontSize}px ${pill.fontFamily}`;
      ctx.textBaseline = "top";
      const metrics = ctx.measureText(upperText);

      const width = metrics.width + padL + padR;
      const height = fontSize + padT + padB;
      const radius = Math.min(
        (pill.borderRadius || height / 2) * sy,
        height / 2,
      );

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

    const nameSpec = makePillSpec(safeName, getPillStyle(nameText));
    const roleSpec = makePillSpec(safeRole, getPillStyle(roleText));

    const roleTop = frameH - bottomInset - roleSpec.height;
    const nameTop = roleTop - gapFrame - nameSpec.height;

    drawPill(nameSpec, leftInset, nameTop);
    drawPill(roleSpec, leftInset, roleTop);

    await downloadCanvasPng(canvas, "poster.png");
  } catch (error) {
    console.error("Error during export:", error);
    errorMessage = "Export failed.";
  } finally {
    setExportLoading(false, errorMessage);
  }
};

exportButton.addEventListener("click", () => {
  exportPoster();
});

const setSuggestionsVisibility = (
  container: HTMLDivElement,
  visible: boolean,
) => {
  container.classList.toggle("hidden", !visible);
};

const clearSuggestions = (container: HTMLDivElement) => {
  container.innerHTML = "";
  setSuggestionsVisibility(container, false);
};

const splitByCursor = (input: HTMLInputElement) => {
  const value = input.value;
  const cursorIndex = input.selectionStart ?? value.length;
  return {
    before: value.slice(0, cursorIndex),
    after: value.slice(cursorIndex),
  };
};

const extractLastToken = (text: string) => {
  const match = text.match(/(\S+)\s*$/);
  if (!match) {
    return { token: "", prefix: text };
  }
  const token = match[1];
  const prefix = text.slice(0, match.index ?? 0);
  return { token, prefix };
};

const applySuggestion = (
  input: HTMLInputElement,
  suggestion: string,
  container: HTMLDivElement,
) => {
  const { before, after } = splitByCursor(input);
  const { prefix } = extractLastToken(before);
  input.value = `${prefix}${suggestion}${after}`;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  const newCursor = (prefix + suggestion).length;
  input.setSelectionRange(newCursor, newCursor);
  clearSuggestions(container);
};

const renderSuggestions = (
  container: HTMLDivElement,
  suggestions: string[],
  onPick: (value: string) => void,
) => {
  container.innerHTML = "";
  if (suggestions.length === 0) {
    setSuggestionsVisibility(container, false);
    return;
  }

  suggestions.forEach((suggestion, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className =
      "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100";
    if (index === 0) {
      item.classList.add("bg-slate-100");
    }
    item.textContent = suggestion;
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      onPick(suggestion);
    });
    container.appendChild(item);
  });

  setSuggestionsVisibility(container, true);
};

const attachTransliteration = (
  input: HTMLInputElement,
  output: HTMLElement,
  container: HTMLDivElement,
  placeholder: string,
) => {
  let debounceHandle: number | null = null;
  let latestRequestId = 0;
  let suppressNextSuggestions = false;

  const updateOutput = () => {
    output.textContent = input.value || placeholder;
  };

  const fetchSuggestions = async () => {
    if (suppressNextSuggestions) {
      return;
    }
    const { before } = splitByCursor(input);
    const { token } = extractLastToken(before);
    if (!token.trim()) {
      clearSuggestions(container);
      return;
    }

    const requestId = (latestRequestId += 1);
    try {
      const suggestions = await getTransliterateSuggestions(token, {
        lang: TRANSLITERATE_LANG,
        numOptions: 6,
        showCurrentWordAsLastSuggestion: true,
      });

      if (requestId !== latestRequestId) {
        return;
      }
      renderSuggestions(container, suggestions, applySuggestionAndPause);
    } catch (error) {
      console.error("Transliteration error:", error);
    }
  };

  const scheduleSuggestions = () => {
    if (debounceHandle) {
      window.clearTimeout(debounceHandle);
    }
    debounceHandle = window.setTimeout(
      fetchSuggestions,
      TRANSLITERATE_DEBOUNCE_MS,
    );
  };

  const applySuggestionAndPause = (suggestion: string) => {
    suppressNextSuggestions = true;
    applySuggestion(input, suggestion, container);
  };

  input.addEventListener("input", () => {
    updateOutput();
    if (suppressNextSuggestions) {
      suppressNextSuggestions = false;
      clearSuggestions(container);
      return;
    }
    scheduleSuggestions();
  });

  input.addEventListener("focus", () => {
    scheduleSuggestions();
  });

  input.addEventListener("blur", () => {
    window.setTimeout(() => clearSuggestions(container), 100);
  });

  input.addEventListener("keydown", (event) => {
    const shouldApply =
      event.key === "Enter" || event.key === "Tab" || event.key === "Return";
    if (!shouldApply) {
      return;
    }

    const firstItem = container.querySelector("button");
    if (!firstItem) {
      return;
    }

    event.preventDefault();
    applySuggestionAndPause(firstItem.textContent || "");
  });

  updateOutput();
};

attachTransliteration(nameInput, nameText, nameSuggestions, "Full Name");
attachTransliteration(roleInput, roleText, roleSuggestions, "Designation");

window.addEventListener("resize", () => {
  applyTransform();
  updateFrameOverlay();
});

applyTransform();
updateFrameOverlay();
