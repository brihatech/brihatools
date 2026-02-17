import { sileo } from "sileo";

import type { PhotoManager } from "./photo-loader";
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
  const photos = photoManager.getPhotos();
  const currentFrameBitmap = photoManager.getFrameBitmap();

  if (!currentFrameBitmap || photos.length === 0 || state.isProcessing) {
    return;
  }

  state.isProcessing = true;
  hooks.onBusyChange(true);
  hooks.onStatus("Preparing photos...");

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  let isFinalized = false;
  let timeoutId: number | null = null;
  const finalize = (statusText?: string) => {
    if (isFinalized) return false;
    isFinalized = true;

    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }

    state.isProcessing = false;
    hooks.onBusyChange(false);

    if (statusText) {
      hooks.onStatus(statusText);
    }

    worker.terminate();

    return true;
  };

  const photosData: Array<{ name: string; bitmap: ImageBitmap }> = [];

  worker.onerror = () => {
    if (finalize("Export failed. Please try again.")) {
      sileo.error({
        title: "Export Failed",
        description: "The exporter stopped unexpectedly. Please try again.",
      });
    }
  };

  worker.onmessageerror = () => {
    if (finalize("Export failed due to worker message error.")) {
      sileo.error({
        title: "Export Failed",
        description: "The export data was invalid. Please try again.",
      });
    }
  };

  worker.onmessage = (event) => {
    const { type, current, total, blob } = event.data;
    if (type === "progress") {
      hooks.onStatus(`Processing ${current}/${total}...`);
      return;
    }

    if (type === "complete") {
      const fileUrl = URL.createObjectURL(blob as Blob);
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = "framed-photos.zip";
      link.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(fileUrl);
      }, 5000);

      if (finalize("Done!")) {
        sileo.success({
          title: "Export Complete",
          description: `${photos.length} framed photo${photos.length === 1 ? "" : "s"} downloaded as a ZIP file.`,
        });
      }
    }
  };

  timeoutId = window.setTimeout(() => {
    if (finalize("Export timed out. Try fewer photos or lower quality.")) {
      sileo.error({
        title: "Export Timed Out",
        description: "Try fewer photos or lower export quality.",
      });
    }
  }, 180000);

  try {
    for (const photo of photos) {
      const readyBitmap = await photoManager.ensurePhotoReady(photo);
      const bitmap = await createImageBitmap(readyBitmap);
      photosData.push({ name: photo.name, bitmap });
    }

    const frameBitmap = await createImageBitmap(currentFrameBitmap);

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
  } catch {
    for (const photo of photosData) {
      photo.bitmap.close();
    }
    if (finalize("Export failed while preparing images.")) {
      sileo.error({
        title: "Export Failed",
        description: "Couldn’t prepare the selected images for export.",
      });
    }
  }
};
