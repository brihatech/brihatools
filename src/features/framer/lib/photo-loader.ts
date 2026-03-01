import { getOrientationType } from "@/lib/image";

import type { PhotoFramerState, PhotoItem, PreviewOrientation } from "./state";

const BATCH_SIZE = 3;

interface PhotoLoaderHooks {
  onStatus: (text: string) => void;
  onPhotosChanged: () => void;
  requestRender: () => void;
}

export interface PhotoManager {
  handleSelection: (files: FileList | null) => void;
  ensurePhotoReady: (photo: PhotoItem) => Promise<void>;
  groupPhotosByOrientation: () => Record<PreviewOrientation, PhotoItem[]>;
  getPhotos: () => PhotoItem[];
  getFrameBitmap: () => ImageBitmap | null;
  getPendingCount: () => number;
  anyReady: () => boolean;
  clearAll: () => void;
}

export const createPhotoManager = (
  state: PhotoFramerState,
  hooks: PhotoLoaderHooks,
): PhotoManager => {
  let currentToken = 0;

  const cleanupPhotos = () => {
    for (const photo of state.photos) {
      URL.revokeObjectURL(photo.url);
      photo.readyPromise = undefined;
    }
  };

  const handleSelection = (files: FileList | null) => {
    const nextFiles = Array.from(files ?? []);
    cleanupPhotos();

    state.photos = nextFiles.map((file) => ({
      file,
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    hooks.onStatus(`${state.photos.length} photos selected`);
    hooks.onPhotosChanged();
    hooks.requestRender();

    if (state.photos.length === 0) return;

    const loadToken = ++currentToken;
    void loadPhotosInBackground(loadToken);
  };

  const loadPhotosInBackground = async (token: number) => {
    const total = state.photos.length;
    if (total === 0) return;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      if (token !== currentToken) return;

      const batch = state.photos.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((photo) => ensurePhotoReady(photo)));

      if (token !== currentToken) return;

      const loaded = state.photos.filter((photo) => photo.width).length;
      const status =
        loaded === total
          ? `${total} photos ready`
          : `Loading... ${loaded}/${total}`;
      hooks.onStatus(status);
      hooks.requestRender();
    }

    if (token === currentToken) {
      hooks.onStatus(`${state.photos.length} photos ready`);
      hooks.requestRender();
    }
  };

  const ensurePhotoReady = async (photo: PhotoItem) => {
    if (photo.width && photo.height) return;

    if (!photo.readyPromise) {
      photo.readyPromise = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          photo.width = img.naturalWidth;
          photo.height = img.naturalHeight;
          photo.orientation = getOrientationType(
            img.naturalWidth,
            img.naturalHeight,
          ) as PreviewOrientation;
          photo.readyPromise = undefined;
          resolve();
        };
        img.onerror = reject;
        img.src = photo.url;
      });
    }

    return photo.readyPromise;
  };

  const groupPhotosByOrientation = () => {
    const grouped: Record<PreviewOrientation, PhotoItem[]> = {
      portrait: [],
      landscape: [],
      square: [],
    };

    for (const photo of state.photos) {
      if (!photo.orientation) continue;
      grouped[photo.orientation].push(photo);
    }

    return grouped;
  };

  const getPendingCount = () => state.photos.filter((p) => !p.width).length;

  const anyReady = () => state.photos.some((p) => Boolean(p.width));

  const clearAll = () => {
    cleanupPhotos();
    currentToken++;
    state.photos = [];
    hooks.onStatus("No photos selected");
    hooks.onPhotosChanged();
    hooks.requestRender();
  };

  return {
    handleSelection,
    ensurePhotoReady,
    groupPhotosByOrientation,
    getPhotos: () => state.photos,
    getFrameBitmap: () => state.frameBitmap,
    getPendingCount,
    anyReady,
    clearAll,
  };
};
