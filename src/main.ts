type PhotoItem = {
  file: File;
  name: string;
  url: string;
  image: HTMLImageElement | null;
  orientation: number | null;
};

type OrientationType = "portrait" | "landscape" | "square";

type AppState = {
  frameFile: File | null;
  frameImage: HTMLImageElement | null;
  frameUrl: string | null;
  photos: PhotoItem[];
  settings: {
    portraitScale: number;
    portraitOffset: number;
    landscapeScale: number;
    landscapeOffset: number;
  };
};

const state: AppState = {
  frameFile: null,
  frameImage: null,
  frameUrl: null,
  photos: [],
  settings: {
    portraitScale: 0.7,
    portraitOffset: 0,
    landscapeScale: 0.9,
    landscapeOffset: 0,
  },
};

const elements = {
  frameInput: document.getElementById("frameInput") as HTMLInputElement,
  photoInput: document.getElementById("photoInput") as HTMLInputElement,
  frameStatus: document.getElementById("frameStatus") as HTMLDivElement,
  photoStatus: document.getElementById("photoStatus") as HTMLDivElement,
  photoList: document.getElementById("photoList") as HTMLDivElement,
  portraitPreviewCanvas: document.getElementById(
    "portraitPreviewCanvas",
  ) as HTMLCanvasElement,
  landscapePreviewCanvas: document.getElementById(
    "landscapePreviewCanvas",
  ) as HTMLCanvasElement,
  portraitPreviewMeta: document.getElementById(
    "portraitPreviewMeta",
  ) as HTMLParagraphElement,
  landscapePreviewMeta: document.getElementById(
    "landscapePreviewMeta",
  ) as HTMLParagraphElement,
  downloadZip: document.getElementById("downloadZip") as HTMLButtonElement,
  downloadStatus: document.getElementById("downloadStatus") as HTMLDivElement,
  portraitScale: document.getElementById("portraitScale") as HTMLInputElement,
  portraitOffset: document.getElementById("portraitOffset") as HTMLInputElement,
  landscapeScale: document.getElementById("landscapeScale") as HTMLInputElement,
  landscapeOffset: document.getElementById(
    "landscapeOffset",
  ) as HTMLInputElement,
  portraitScaleValue: document.getElementById(
    "portraitScaleValue",
  ) as HTMLSpanElement,
  portraitOffsetValue: document.getElementById(
    "portraitOffsetValue",
  ) as HTMLSpanElement,
  landscapeScaleValue: document.getElementById(
    "landscapeScaleValue",
  ) as HTMLSpanElement,
  landscapeOffsetValue: document.getElementById(
    "landscapeOffsetValue",
  ) as HTMLSpanElement,
};

const portraitContext = elements.portraitPreviewCanvas.getContext(
  "2d",
) as CanvasRenderingContext2D;
const landscapeContext = elements.landscapePreviewCanvas.getContext(
  "2d",
) as CanvasRenderingContext2D;

function debounce<T extends (...args: never[]) => void>(
  callback: T,
  wait = 150,
) {
  let timeout: number | undefined;
  return (...args: Parameters<T>) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => callback(...args), wait);
  };
}

function updateSliderLabels() {
  elements.portraitScaleValue.textContent =
    state.settings.portraitScale.toFixed(2);
  elements.portraitOffsetValue.textContent =
    state.settings.portraitOffset.toFixed(2);
  elements.landscapeScaleValue.textContent =
    state.settings.landscapeScale.toFixed(2);
  elements.landscapeOffsetValue.textContent =
    state.settings.landscapeOffset.toFixed(2);
}

function setDownloadEnabled(enabled: boolean) {
  elements.downloadZip.disabled = !enabled;
}

function updatePhotoList() {
  elements.photoList.innerHTML = "";
  state.photos.forEach((photo) => {
    const wrapper = document.createElement("div");
    wrapper.className =
      "group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100";

    const img = document.createElement("img");
    img.src = photo.url;
    img.alt = photo.name;
    img.className = "h-full w-full object-cover";

    wrapper.appendChild(img);
    elements.photoList.appendChild(wrapper);
  });
}

function getPhotoOrientation(width: number, height: number): OrientationType {
  const diff = Math.abs(width - height) / Math.max(width, height);
  if (diff < 0.01) return "square";
  return height > width ? "portrait" : "landscape";
}

function getTargetSize(
  frameWidth: number,
  frameHeight: number,
  photoWidth: number,
  photoHeight: number,
  orientation: OrientationType,
) {
  if (orientation === "portrait") {
    let targetHeight = frameHeight * state.settings.portraitScale;
    let targetWidth = targetHeight * (photoWidth / photoHeight);
    const maxWidth = frameWidth * state.settings.portraitScale;
    if (targetWidth > maxWidth) {
      targetWidth = maxWidth;
      targetHeight = targetWidth * (photoHeight / photoWidth);
    }
    return { targetWidth, targetHeight };
  }

  let targetWidth = frameWidth * state.settings.landscapeScale;
  let targetHeight = targetWidth * (photoHeight / photoWidth);
  const maxHeight = frameHeight * state.settings.landscapeScale;
  if (targetHeight > maxHeight) {
    targetHeight = maxHeight;
    targetWidth = targetHeight * (photoWidth / photoHeight);
  }
  return { targetWidth, targetHeight };
}

async function getExifOrientation(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const view = new DataView(reader.result as ArrayBuffer);
        const exifData = (
          window as Window & {
            EXIF: {
              readFromBinaryFile: (view: DataView) => { Orientation?: number };
            };
          }
        ).EXIF.readFromBinaryFile(view);
        resolve(exifData?.Orientation || 1);
      } catch {
        resolve(1);
      }
    };
    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(file);
  });
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function getOrientedDimensions(image: HTMLImageElement, orientation: number) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if ([5, 6, 7, 8].includes(orientation)) {
    return { width: height, height: width };
  }
  return { width, height };
}

function drawOrientedImage(
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

async function preparePhoto(photo: PhotoItem) {
  if (!photo.image) {
    photo.image = await loadImageFromUrl(photo.url);
  }
  if (!photo.orientation) {
    photo.orientation = await getExifOrientation(photo.file);
  }
  return photo;
}

async function findPhotoForOrientation(targetOrientation: OrientationType) {
  for (const photo of state.photos) {
    const prepared = await preparePhoto(photo);
    const orientedDims = getOrientedDimensions(
      prepared.image,
      prepared.orientation ?? 1,
    );
    const orientationType = getPhotoOrientation(
      orientedDims.width,
      orientedDims.height,
    );
    if (orientationType === targetOrientation) {
      return { photo: prepared, orientationType, orientedDims };
    }
  }
  return null;
}

function drawFrameOnly(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) {
  if (!state.frameImage) return;
  const frameWidth = state.frameImage.naturalWidth;
  const frameHeight = state.frameImage.naturalHeight;
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  ctx.clearRect(0, 0, frameWidth, frameHeight);
  ctx.drawImage(state.frameImage, 0, 0, frameWidth, frameHeight);
}

async function renderPreview(
  targetOrientation: OrientationType,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  metaElement: HTMLElement,
) {
  if (!state.frameImage) {
    canvas.width = 1;
    canvas.height = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    metaElement.textContent = "Upload a frame to begin";
    return;
  }

  if (state.photos.length === 0) {
    drawFrameOnly(ctx, canvas);
    metaElement.textContent = "No photos selected";
    return;
  }

  const match = await findPhotoForOrientation(targetOrientation);
  if (!match) {
    drawFrameOnly(ctx, canvas);
    metaElement.textContent = `No ${targetOrientation} photos found`;
    return;
  }

  const { photo, orientedDims, orientationType } = match;
  const frameWidth = state.frameImage.naturalWidth;
  const frameHeight = state.frameImage.naturalHeight;
  const { targetWidth, targetHeight } = getTargetSize(
    frameWidth,
    frameHeight,
    orientedDims.width,
    orientedDims.height,
    orientationType,
  );

  const centerX = (frameWidth - targetWidth) / 2;
  const centerY = (frameHeight - targetHeight) / 2;
  const offset =
    orientationType === "portrait"
      ? state.settings.portraitOffset * frameHeight
      : state.settings.landscapeOffset * frameHeight;

  canvas.width = frameWidth;
  canvas.height = frameHeight;
  ctx.clearRect(0, 0, frameWidth, frameHeight);
  ctx.drawImage(state.frameImage, 0, 0, frameWidth, frameHeight);
  drawOrientedImage(
    ctx,
    photo.image as HTMLImageElement,
    photo.orientation ?? 1,
    centerX,
    centerY + offset,
    targetWidth,
    targetHeight,
  );

  metaElement.textContent = `${photo.name} • ${orientationType}`;
}

async function renderPreviews() {
  await renderPreview(
    "portrait",
    portraitContext,
    elements.portraitPreviewCanvas,
    elements.portraitPreviewMeta,
  );
  await renderPreview(
    "landscape",
    landscapeContext,
    elements.landscapePreviewCanvas,
    elements.landscapePreviewMeta,
  );
  setDownloadEnabled(Boolean(state.frameImage && state.photos.length));
}

async function renderPhotoToBlob(photo: PhotoItem) {
  const frameWidth = state.frameImage?.naturalWidth ?? 0;
  const frameHeight = state.frameImage?.naturalHeight ?? 0;
  const prepared = await preparePhoto(photo);
  const orientedDims = getOrientedDimensions(
    prepared.image as HTMLImageElement,
    prepared.orientation ?? 1,
  );
  const orientationType = getPhotoOrientation(
    orientedDims.width,
    orientedDims.height,
  );
  const { targetWidth, targetHeight } = getTargetSize(
    frameWidth,
    frameHeight,
    orientedDims.width,
    orientedDims.height,
    orientationType,
  );

  const centerX = (frameWidth - targetWidth) / 2;
  const centerY = (frameHeight - targetHeight) / 2;
  const offset =
    orientationType === "portrait"
      ? state.settings.portraitOffset * frameHeight
      : state.settings.landscapeOffset * frameHeight;

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = frameWidth;
  outputCanvas.height = frameHeight;
  const ctx = outputCanvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.drawImage(
    state.frameImage as HTMLImageElement,
    0,
    0,
    frameWidth,
    frameHeight,
  );
  drawOrientedImage(
    ctx,
    prepared.image as HTMLImageElement,
    prepared.orientation ?? 1,
    centerX,
    centerY + offset,
    targetWidth,
    targetHeight,
  );

  return new Promise<Blob | null>((resolve) => {
    outputCanvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

function resetPhotos() {
  state.photos.forEach((photo) => URL.revokeObjectURL(photo.url));
  state.photos = [];
  updatePhotoList();
  renderPreviews();
}

elements.frameInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (state.frameUrl) {
    URL.revokeObjectURL(state.frameUrl);
  }

  state.frameFile = file;
  state.frameUrl = URL.createObjectURL(file);
  state.frameImage = await loadImageFromUrl(state.frameUrl);
  elements.frameStatus.textContent = file.name;
  renderPreviews();
});

elements.photoInput.addEventListener("change", (event) => {
  const files = Array.from(event.target.files ?? []);
  resetPhotos();

  state.photos = files.map((file) => ({
    file,
    name: file.name,
    url: URL.createObjectURL(file),
    image: null,
    orientation: null,
  }));

  elements.photoStatus.textContent = `${state.photos.length} photo${state.photos.length !== 1 ? "s" : ""} selected`;
  updatePhotoList();
  renderPreviews();
});

const debouncedRender = debounce(renderPreviews, 200);

[
  elements.portraitScale,
  elements.portraitOffset,
  elements.landscapeScale,
  elements.landscapeOffset,
].forEach((slider) => {
  slider.addEventListener("input", () => {
    state.settings.portraitScale = Number(elements.portraitScale.value);
    state.settings.portraitOffset = Number(elements.portraitOffset.value);
    state.settings.landscapeScale = Number(elements.landscapeScale.value);
    state.settings.landscapeOffset = Number(elements.landscapeOffset.value);
    updateSliderLabels();
    debouncedRender();
  });
});

elements.downloadZip.addEventListener("click", async () => {
  if (!state.frameImage || state.photos.length === 0) return;

  elements.downloadZip.disabled = true;
  elements.downloadStatus.textContent = "Preparing ZIP...";

  const zip = new (
    window as Window & {
      JSZip: new () => {
        file: (name: string, data: Blob) => void;
        generateAsync: (options: { type: "blob" }) => Promise<Blob>;
      };
    }
  ).JSZip();
  for (let i = 0; i < state.photos.length; i += 1) {
    const photo = state.photos[i];
    elements.downloadStatus.textContent = `Processing ${i + 1} of ${state.photos.length}`;
    const blob = await renderPhotoToBlob(photo);
    if (blob) {
      const baseName = photo.name.replace(/\.[^/.]+$/, "");
      zip.file(`${baseName}-framed.png`, blob);
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const downloadUrl = URL.createObjectURL(zipBlob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "framed-photos.zip";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);

  elements.downloadStatus.textContent = "ZIP download ready";
  elements.downloadZip.disabled = false;
});

updateSliderLabels();
renderPreviews();
