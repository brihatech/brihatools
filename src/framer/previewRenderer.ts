import {
  calculateTargetSize,
  type Dimensions,
  type OrientationType,
} from "@/lib/image";

import {
  type CompositionSettings,
  normalizePreviewIndex,
  type PhotoFramerState,
  type PhotoItem,
  PREVIEW_ORIENTATIONS,
  type PreviewOrientation,
} from "./state";
import { type PhotoFramerUI, setNavState, setPreviewLoading } from "./ui";

interface RenderParams {
  state: PhotoFramerState;
  ui: PhotoFramerUI;
  grouped: Record<PreviewOrientation, PhotoItem[]>;
  pendingCount: number;
  anyReady: () => boolean;
}

interface RenderContext {
  frame: HTMLImageElement;
  photo: ImageBitmap;
  settings: CompositionSettings;
}

export const renderPreviews = ({
  state,
  ui,
  grouped,
  pendingCount,
  anyReady,
}: RenderParams) => {
  if (!state.frame) {
    [ui.portraitCanvas, ui.landscapeCanvas].forEach((canvas) => {
      canvas.width = 1;
      canvas.height = 1;
      canvas.getContext("2d")?.clearRect(0, 0, 1, 1);
    });

    ui.portraitMeta.textContent = ui.landscapeMeta.textContent =
      "Upload a frame to begin";

    PREVIEW_ORIENTATIONS.forEach((type) => {
      setNavState(ui, type, 0);
      setPreviewLoading(ui, type, false);
    });

    ui.downloadBtn.disabled = true;
    return;
  }

  for (const type of PREVIEW_ORIENTATIONS) {
    const canvas = type === "portrait" ? ui.portraitCanvas : ui.landscapeCanvas;
    const meta = type === "portrait" ? ui.portraitMeta : ui.landscapeMeta;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    const matches = grouped[type];
    setNavState(ui, type, matches.length);

    const isTypeLoading =
      matches.length === 0 && state.photos.length > 0 && pendingCount > 0;

    canvas.width = state.frame.naturalWidth;
    canvas.height = state.frame.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (matches.length > 0) {
      const normalizedIndex = normalizePreviewIndex(
        state.previewIndex[type],
        matches.length,
      );
      state.previewIndex[type] = normalizedIndex;
      const matchedPhoto = matches[normalizedIndex];
      const photoBitmap = matchedPhoto.bitmap;

      if (!photoBitmap) {
        setPreviewLoading(ui, type, true);
        meta.textContent = `Loading ${matchedPhoto.name}...`;
        ctx.drawImage(state.frame, 0, 0);
        continue;
      }

      setPreviewLoading(ui, type, false);
      compose(ctx, {
        frame: state.frame,
        photo: photoBitmap,
        settings: state.settings[type],
      });
      meta.textContent = `${matchedPhoto.name} • ${type} (${normalizedIndex + 1}/${matches.length})`;
    } else {
      ctx.drawImage(state.frame, 0, 0);
      if (isTypeLoading) {
        setPreviewLoading(ui, type, true);
        meta.textContent = `Loading ${type} photos...`;
      } else {
        setPreviewLoading(ui, type, false);
        meta.textContent =
          state.photos.length === 0
            ? "Upload photos to preview"
            : `No ${type} photos selected`;
      }
    }
  }

  ui.downloadBtn.disabled = !anyReady() || state.isProcessing;
};

const compose = (ctx: CanvasRenderingContext2D, data: RenderContext) => {
  const frameDims: Dimensions = {
    width: data.frame.naturalWidth,
    height: data.frame.naturalHeight,
  };

  const bitmap = data.photo;
  const orientedDims = {
    width: bitmap.width,
    height: bitmap.height,
  };
  const orientationType: OrientationType =
    orientedDims.height > orientedDims.width ? "portrait" : "landscape";

  const { width: targetWidth, height: targetHeight } = calculateTargetSize(
    frameDims,
    orientedDims,
    data.settings.scale,
    orientationType,
  );

  const centerX = (frameDims.width - targetWidth) / 2;
  const centerY = (frameDims.height - targetHeight) / 2;
  const offsetValue = data.settings.offset * frameDims.height;

  ctx.drawImage(data.frame, 0, 0, frameDims.width, frameDims.height);
  ctx.drawImage(
    bitmap,
    centerX,
    centerY + offsetValue,
    targetWidth,
    targetHeight,
  );
};
