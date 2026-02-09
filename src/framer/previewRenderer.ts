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

interface RenderParams {
  state: PhotoFramerState;
  portraitCanvas: HTMLCanvasElement;
  landscapeCanvas: HTMLCanvasElement;
  grouped: Record<PreviewOrientation, PhotoItem[]>;
  pendingCount: number;
  anyReady: () => boolean;
}

export interface PreviewUiState {
  portrait: {
    meta: string;
    isLoading: boolean;
    count: number;
    index: number;
    navDisabled: boolean;
  };
  landscape: {
    meta: string;
    isLoading: boolean;
    count: number;
    index: number;
    navDisabled: boolean;
  };
  downloadDisabled: boolean;
}

interface RenderContext {
  frame: HTMLImageElement;
  photo: ImageBitmap;
  settings: CompositionSettings;
}

export const renderPreviews = ({
  state,
  portraitCanvas,
  landscapeCanvas,
  grouped,
  pendingCount,
  anyReady,
}: RenderParams) => {
  const result: PreviewUiState = {
    portrait: {
      meta: "",
      isLoading: false,
      count: 0,
      index: 0,
      navDisabled: true,
    },
    landscape: {
      meta: "",
      isLoading: false,
      count: 0,
      index: 0,
      navDisabled: true,
    },
    downloadDisabled: true,
  };

  if (!state.frame) {
    [portraitCanvas, landscapeCanvas].forEach((canvas) => {
      canvas.width = 1;
      canvas.height = 1;
      canvas.getContext("2d")?.clearRect(0, 0, 1, 1);
    });

    result.portrait.meta = "Upload a frame to begin";
    result.landscape.meta = "Upload a frame to begin";
    result.downloadDisabled = true;
    return result;
  }

  for (const type of PREVIEW_ORIENTATIONS) {
    const canvas = type === "portrait" ? portraitCanvas : landscapeCanvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    const matches = grouped[type];
    const navDisabled = matches.length <= 1;

    const isTypeLoading =
      matches.length === 0 && state.photos.length > 0 && pendingCount > 0;

    canvas.width = state.frame.naturalWidth;
    canvas.height = state.frame.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const out = type === "portrait" ? result.portrait : result.landscape;
    out.count = matches.length;
    out.navDisabled = navDisabled;

    if (matches.length > 0) {
      const normalizedIndex = normalizePreviewIndex(
        state.previewIndex[type],
        matches.length,
      );
      state.previewIndex[type] = normalizedIndex;
      out.index = normalizedIndex;
      const matchedPhoto = matches[normalizedIndex];
      const photoBitmap = matchedPhoto.bitmap;

      if (!photoBitmap) {
        out.isLoading = true;
        out.meta = `Loading ${matchedPhoto.name}...`;
        ctx.drawImage(state.frame, 0, 0);
        continue;
      }

      out.isLoading = false;
      compose(ctx, {
        frame: state.frame,
        photo: photoBitmap,
        settings: state.settings[type],
      });
      out.meta = `${matchedPhoto.name} • ${type} (${normalizedIndex + 1}/${matches.length})`;
    } else {
      ctx.drawImage(state.frame, 0, 0);
      if (isTypeLoading) {
        out.isLoading = true;
        out.meta = `Loading ${type} photos...`;
      } else {
        out.isLoading = false;
        out.meta =
          state.photos.length === 0
            ? "Upload photos to preview"
            : `No ${type} photos selected`;
      }
    }
  }

  result.downloadDisabled = !anyReady() || state.isProcessing;
  return result;
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
