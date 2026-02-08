import html2canvas from "html2canvas-pro";
import * as ort from "onnxruntime-web";

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
  !roleText
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
  let offsetX = 0;
  let offsetY = 0;

  if (stageRatio > frameRatio) {
    imageHeight = stageHeight;
    imageWidth = imageHeight * frameRatio;
    offsetX = (stageWidth - imageWidth) / 2;
  } else {
    imageWidth = stageWidth;
    imageHeight = imageWidth / frameRatio;
    offsetY = (stageHeight - imageHeight) / 2;
  }

  stage.style.setProperty("--frame-x", `${offsetX}px`);
  stage.style.setProperty("--frame-y", `${offsetY}px`);
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

if (frameImage.complete) {
  updateFrameOverlay();
} else {
  frameImage.addEventListener("load", updateFrameOverlay);
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

  const reader = new FileReader();
  reader.onload = () => {
    setPhotoState(String(reader.result || ""));
  };
  reader.readAsDataURL(file);
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
    photoImage.src = processedSource;
    photoPreview.src = processedSource;
    removeBgUsed = true;
    setRemoveBgLoading(false, "Background removed");
  } catch (error) {
    console.error("Error during background removal:", error);
    errorMessage = "Background removal failed.";
  } finally {
    if (!errorMessage) {
      return;
    }
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

    const canvas = await html2canvas(stage, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = "poster.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
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

nameInput.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement;
  nameText.textContent = target.value || "Full Name";
});

roleInput.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement;
  roleText.textContent = target.value || "Designation";
});

window.addEventListener("resize", () => {
  applyTransform();
  updateFrameOverlay();
});

applyTransform();
updateFrameOverlay();
