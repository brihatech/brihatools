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

ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";

let modelSessionPromise: Promise<ort.InferenceSession> | null = null;
let processorSessionPromise: Promise<ort.InferenceSession> | null = null;

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

export async function removeBackground(photoSrc: string): Promise<string> {
  const image = new Image();
  image.src = photoSrc;
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
  const shapeTensor = new ort.Tensor("int64", [image.height, image.width], [2]);
  const inputDictProcessor = {
    [MASK_TENSOR_NAME]: maskTensor,
    [ORIGINAL_SHAPE_TENSOR_NAME]: shapeTensor,
  };

  const outputProcessor = await processorSession.run(inputDictProcessor);
  const resizedMask = outputProcessor[OUTPUT_RESIZED_TENSOR_NAME].data;

  return applyMaskToImage(image, resizedMask);
}
