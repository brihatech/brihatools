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
  "https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_quantized.onnx";
const HQ_NORMALIZE_MEAN = [0.5, 0.5, 0.5];
const HQ_NORMALIZE_STD = [1, 1, 1];

ort.env.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.1/dist/";

let modelSessionPromise: Promise<ort.InferenceSession> | null = null;
let processorSessionPromise: Promise<ort.InferenceSession> | null = null;
let hqModelSessionPromise: Promise<ort.InferenceSession> | null = null;

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

const getHighQualityModelSession = () => {
  if (!hqModelSessionPromise) {
    hqModelSessionPromise = ort.InferenceSession.create(HQ_MODEL_PATH, {
      executionProviders: ["wasm"],
    });
  }
  return hqModelSessionPromise;
};

const preprocessImage = (
  image: HTMLImageElement,
  width: number,
  height: number,
  mean: number[],
  std: number[],
) => {
  const offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;
  const ctx = offscreenCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas context.");
  }

  ctx.drawImage(image, 0, 0, width, height);
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
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = maskWidth;
  maskCanvas.height = maskHeight;
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

  const resizeCanvas = document.createElement("canvas");
  resizeCanvas.width = imageWidth;
  resizeCanvas.height = imageHeight;
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
    return { height: dims[2] ?? HQ_IMAGE_HEIGHT, width: dims[3] ?? HQ_IMAGE_WIDTH };
  }
  if (dims.length === 3) {
    return { height: dims[1] ?? HQ_IMAGE_HEIGHT, width: dims[2] ?? HQ_IMAGE_WIDTH };
  }
  if (dims.length === 2) {
    return { height: dims[0] ?? HQ_IMAGE_HEIGHT, width: dims[1] ?? HQ_IMAGE_WIDTH };
  }
  return { height: HQ_IMAGE_HEIGHT, width: HQ_IMAGE_WIDTH };
};

const removeBackgroundStandard = async (photoSrc: string) => {
  const image = new Image();
  image.src = photoSrc;
  await image.decode();

  const [modelSession, processorSession] = await Promise.all([
    getModelSession(),
    getProcessorSession(),
  ]);

  const pixelsTensor = preprocessImage(
    image,
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
  const shapeTensor = new ort.Tensor("int64", [image.height, image.width], [2]);
  const inputDictProcessor = {
    [MASK_TENSOR_NAME]: maskTensor,
    [ORIGINAL_SHAPE_TENSOR_NAME]: shapeTensor,
  };

  const outputProcessor = await processorSession.run(inputDictProcessor);
  const resizedMask = outputProcessor[OUTPUT_RESIZED_TENSOR_NAME].data;

  return applyMaskToImage(image, resizedMask);
};

const removeBackgroundHighQuality = async (photoSrc: string) => {
  const image = new Image();
  image.src = photoSrc;
  await image.decode();

  const modelSession = await getHighQualityModelSession();

  const inputName = modelSession.inputNames[0] ?? "input";
  const outputName = modelSession.outputNames[0] ?? "output";

  const pixelsTensor = preprocessImage(
    image,
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
    image.width,
    image.height,
  );

  return applyMaskToImage(image, resizedMask);
};

export type BackgroundRemovalQuality = "standard" | "hq";

export async function removeBackground(
  photoSrc: string,
  quality: BackgroundRemovalQuality = "standard",
): Promise<string> {
  if (quality === "hq") {
    return removeBackgroundHighQuality(photoSrc);
  }

  return removeBackgroundStandard(photoSrc);
}
