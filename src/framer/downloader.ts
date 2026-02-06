import type { PhotoManager } from "./photoLoader";
import type { PhotoFramerUI } from "./ui";
import { getExportScale, type PhotoFramerState } from "./state";

export const handleDownload = async (
  state: PhotoFramerState,
  ui: PhotoFramerUI,
  photoManager: PhotoManager,
) => {
  if (!state.frameBitmap || state.photos.length === 0 || state.isProcessing) {
    return;
  }

  state.isProcessing = true;
  ui.downloadBtn.disabled = true;
  ui.status.textContent = "Preparing photos...";

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const photosData: Array<{ name: string; bitmap: ImageBitmap }> = [];
  for (const photo of state.photos) {
    const readyBitmap = await photoManager.ensurePhotoReady(photo);
    const bitmap = await createImageBitmap(readyBitmap);
    photosData.push({ name: photo.name, bitmap });
  }

  const frameBitmap = await createImageBitmap(state.frameBitmap);

  worker.onmessage = (event) => {
    const { type, current, total, blob } = event.data;
    if (type === "progress") {
      ui.status.textContent = `Processing ${current}/${total}...`;
      return;
    }

    if (type === "complete") {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "framed-photos.zip";
      link.click();

      ui.status.textContent = "Done!";
      state.isProcessing = false;
      ui.downloadBtn.disabled = false;
      worker.terminate();
    }
  };

  const transferables = [
    frameBitmap,
    ...photosData.map((photo) => photo.bitmap),
  ];
  worker.postMessage(
    {
      frame: frameBitmap,
      photos: photosData,
      settings: state.settings,
      exportScale: getExportScale(state.exportQuality),
    },
    transferables,
  );
};
