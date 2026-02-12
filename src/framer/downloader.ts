import type { PhotoManager } from "./photoLoader";
import { getExportScale, type PhotoFramerState } from "./state";

export interface DownloadHooks {
  onStatus: (text: string) => void;
  onBusyChange: (busy: boolean) => void;
}

export const handleDownload = async (
  state: PhotoFramerState,
  photoManager: PhotoManager,
  hooks: DownloadHooks,
) => {
  if (!state.frameBitmap || state.photos.length === 0 || state.isProcessing) {
    return;
  }

  state.isProcessing = true;
  hooks.onBusyChange(true);
  hooks.onStatus("Preparing photos...");

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
      hooks.onStatus(`Processing ${current}/${total}...`);
      return;
    }

    if (type === "complete") {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "framed-photos.zip";
      link.click();

      hooks.onStatus("Done!");
      state.isProcessing = false;
      hooks.onBusyChange(false);
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
      settings: JSON.parse(JSON.stringify(state.settings)),
      exportScale: getExportScale(state.exportQuality),
    },
    transferables,
  );
};
