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

const HQ_IMAGE_WIDTH = 1024;
const HQ_IMAGE_HEIGHT = 1024;
const HQ_MODEL_PATH =
  "https://r2-cf.tejascorp.com.np/rmbg-1.4/model_quantized.onnx";
const HQ_NORMALIZE_MEAN = [0.5, 0.5, 0.5];
const HQ_NORMALIZE_STD = [1, 1, 1];

ort.env.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.1/dist/";
ort.env.wasm.simd = true;
ort.env.wasm.numThreads =
  navigator.hardwareConcurrency > 1
    ? Math.min(navigator.hardwareConcurrency, 4)
    : 1;

let modelSessionPromise: Promise<ort.InferenceSession> | null = null;
let processorSessionPromise: Promise<ort.InferenceSession> | null = null;
let hqModelSessionPromise: Promise<ort.InferenceSession> | null = null;

const getModelSession = () => {
  if (!modelSessionPromise) {
    modelSessionPromise = ort.InferenceSession.create(ONNX_MODEL_PATH, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
  }
  return modelSessionPromise;
};

const getProcessorSession = () => {
  if (!processorSessionPromise) {
    processorSessionPromise = ort.InferenceSession.create(ONNX_PROCESSOR_PATH, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
  }
  return processorSessionPromise;
};

const getHighQualityModelSession = () => {
  if (!hqModelSessionPromise) {
    hqModelSessionPromise = ort.InferenceSession.create(HQ_MODEL_PATH, {
      executionProviders: ["webgpu", "wasm"],
      graphOptimizationLevel: "all",
    });
  }
  return hqModelSessionPromise;
};

// Pre-warm standard model sessions immediately when the worker loads.
// This runs in the background while the user is still uploading their photo,
// so by the time they click "Remove Background" the sessions are ready.
getModelSession();
getProcessorSession();

const preprocessImage = (
  bitmap: ImageBitmap,
  width: number,
  height: number,
  mean: number[],
  std: number[],
) => {
  const offscreenCanvas = new OffscreenCanvas(width, height);
  const ctx = offscreenCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas context.");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const pixels = new Float32Array(IMAGE_CHANNELS * width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = (data[index] / 255 - mean[0]) / std[0];
      const g = (data[index + 1] / 255 - mean[1]) / std[1];
      const b = (data[index + 2] / 255 - mean[2]) / std[2];

      const newIndex = y * width + x;
      pixels[newIndex] = r;
      pixels[newIndex + width * height] = g;
      pixels[newIndex + 2 * width * height] = b;
    }
  }

  return new ort.Tensor("float32", pixels, [1, IMAGE_CHANNELS, width, height]);
};

const applyMaskToImage = async (
  bitmap: ImageBitmap,
  resizedMask: Float32Array | ort.Tensor.DataTypeMap[ort.Tensor.Type],
) => {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas context.");
  }

  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

  for (let y = 0; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      const index = (y * bitmap.width + x) * 4;
      const maskIndex = y * bitmap.width + x;
      imageData.data[index + 3] = 255 * Number(resizedMask[maskIndex]);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
};

const normalizeMask = (mask: ArrayLike<number>) => {
  const length = mask.length;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < length; i += 1) {
    const value = Number(mask[i]);
    if (value < min) min = value;
    if (value > max) max = value;
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    const passthrough = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      passthrough[i] = Number(mask[i]);
    }
    return passthrough;
  }

  const range = max - min;
  const normalized = new Float32Array(length);
  for (let i = 0; i < normalized.length; i += 1) {
    normalized[i] = (Number(mask[i]) - min) / range;
  }

  return normalized;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const resizeMaskToImage = (
  mask: Float32Array,
  maskWidth: number,
  maskHeight: number,
  imageWidth: number,
  imageHeight: number,
) => {
  const maskCanvas = new OffscreenCanvas(maskWidth, maskHeight);
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) {
    throw new Error("Unable to create canvas context.");
  }

  const maskData = maskCtx.createImageData(maskWidth, maskHeight);
  const pixelCount = maskWidth * maskHeight;
  for (let i = 0; i < pixelCount; i += 1) {
    const value = clamp01(mask[i] ?? 0) * 255;
    const offset = i * 4;
    maskData.data[offset] = value;
    maskData.data[offset + 1] = value;
    maskData.data[offset + 2] = value;
    maskData.data[offset + 3] = 255;
  }
  maskCtx.putImageData(maskData, 0, 0);

  const resizeCanvas = new OffscreenCanvas(imageWidth, imageHeight);
  const resizeCtx = resizeCanvas.getContext("2d");
  if (!resizeCtx) {
    throw new Error("Unable to create canvas context.");
  }

  resizeCtx.drawImage(maskCanvas, 0, 0, imageWidth, imageHeight);
  const resizedData = resizeCtx.getImageData(
    0,
    0,
    imageWidth,
    imageHeight,
  ).data;

  const resizedMask = new Float32Array(imageWidth * imageHeight);
  for (let i = 0; i < resizedMask.length; i += 1) {
    resizedMask[i] = resizedData[i * 4] / 255;
  }

  return resizedMask;
};

const getMaskDimensions = (tensor: ort.Tensor) => {
  const dims = tensor.dims ?? [];
  if (dims.length === 4) {
    return {
      height: dims[2] ?? HQ_IMAGE_HEIGHT,
      width: dims[3] ?? HQ_IMAGE_WIDTH,
    };
  }
  if (dims.length === 3) {
    return {
      height: dims[1] ?? HQ_IMAGE_HEIGHT,
      width: dims[2] ?? HQ_IMAGE_WIDTH,
    };
  }
  if (dims.length === 2) {
    return {
      height: dims[0] ?? HQ_IMAGE_HEIGHT,
      width: dims[1] ?? HQ_IMAGE_WIDTH,
    };
  }
  return { height: HQ_IMAGE_HEIGHT, width: HQ_IMAGE_WIDTH };
};

const MAX_STD_INPUT_PX = 1024;

const downscaleBitmap = async (
  bitmap: ImageBitmap,
  maxPx: number,
): Promise<ImageBitmap> => {
  const { width, height } = bitmap;
  if (width <= maxPx && height <= maxPx) return bitmap;
  const scale = maxPx / Math.max(width, height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return bitmap;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const scaled = await createImageBitmap(canvas);
  bitmap.close();
  return scaled;
};

const removeBackgroundStandard = async (photoSrc: string) => {
  const response = await fetch(photoSrc);
  const blob = await response.blob();
  const rawBitmap = await createImageBitmap(blob);
  // Downscale before inference — model runs at 320×320 anyway
  const bitmap = await downscaleBitmap(rawBitmap, MAX_STD_INPUT_PX);

  const [modelSession, processorSession] = await Promise.all([
    getModelSession(),
    getProcessorSession(),
  ]);

  const pixelsTensor = preprocessImage(
    bitmap,
    IMAGE_WIDTH,
    IMAGE_HEIGHT,
    NORMALIZE_MEAN,
    NORMALIZE_STD,
  );
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
    [BigInt(bitmap.height), BigInt(bitmap.width)],
    [2],
  );
  const inputDictProcessor = {
    [MASK_TENSOR_NAME]: maskTensor,
    [ORIGINAL_SHAPE_TENSOR_NAME]: shapeTensor,
  };

  const outputProcessor = await processorSession.run(inputDictProcessor);
  const resizedMask = outputProcessor[OUTPUT_RESIZED_TENSOR_NAME].data;

  const resultBlob = await applyMaskToImage(bitmap, resizedMask);
  bitmap.close();
  return resultBlob;
};

const removeBackgroundHighQuality = async (photoSrc: string) => {
  const response = await fetch(photoSrc);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const modelSession = await getHighQualityModelSession();

  const inputName = modelSession.inputNames[0] ?? "input";
  const outputName = modelSession.outputNames[0] ?? "output";

  const pixelsTensor = preprocessImage(
    bitmap,
    HQ_IMAGE_WIDTH,
    HQ_IMAGE_HEIGHT,
    HQ_NORMALIZE_MEAN,
    HQ_NORMALIZE_STD,
  );
  const inputDictModel = { [inputName]: pixelsTensor };
  const outputModel = await modelSession.run(inputDictModel);
  const outputTensor = outputModel[outputName];
  const mask = normalizeMask(outputTensor.data as ArrayLike<number>);
  const { width, height } = getMaskDimensions(outputTensor);
  const resizedMask = resizeMaskToImage(
    mask,
    width,
    height,
    bitmap.width,
    bitmap.height,
  );

  const resultBlob = await applyMaskToImage(bitmap, resizedMask);
  bitmap.close();
  return resultBlob;
};

export type BackgroundRemovalQuality = "standard" | "hq";

self.onmessage = async (e: MessageEvent) => {
  const { photoSrc, quality, id } = e.data;

  try {
    let resultBlob: Blob;
    if (quality === "hq") {
      resultBlob = await removeBackgroundHighQuality(photoSrc);
    } else {
      resultBlob = await removeBackgroundStandard(photoSrc);
    }

    self.postMessage({ id, blob: resultBlob });
  } catch (error) {
    self.postMessage({ id, error: (error as Error).message });
  }
};
