import type { CSSProperties } from "react";

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
  grouped: Record<PreviewOrientation, PhotoItem[]>;
  pendingCount: number;
  anyReady: () => boolean;
}

export interface PreviewUiState {
  portrait: PreviewOrientationState;
  landscape: PreviewOrientationState;
  square: PreviewOrientationState;
  downloadDisabled: boolean;
  frameSrc?: string;
  frameDims?: Dimensions;
}

export interface PreviewOrientationState {
  meta: string;
  isLoading: boolean;
  count: number;
  index: number;
  navDisabled: boolean;
  photoUrl?: string;
  style?: CSSProperties;
}

export const getPreviewState = ({
  state,
  grouped,
  pendingCount,
  anyReady,
}: RenderParams): PreviewUiState => {
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
    square: {
      meta: "",
      isLoading: false,
      count: 0,
      index: 0,
      navDisabled: true,
    },
    downloadDisabled: true,
  };

  if (!state.frame) {
    result.portrait.meta = "Upload a frame to begin";
    result.landscape.meta = "Upload a frame to begin";
    result.downloadDisabled = true;
    return result;
  }

  result.frameSrc = state.frame.src;
  result.frameDims = {
    width: state.frame.naturalWidth,
    height: state.frame.naturalHeight,
  };

  for (const type of PREVIEW_ORIENTATIONS) {
    const matches = grouped[type];
    const navDisabled = matches.length <= 1;

    const isTypeLoading =
      matches.length === 0 && state.photos.length > 0 && pendingCount > 0;

    const out = result[type];
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
        continue;
      }

      out.isLoading = false;
      out.photoUrl = matchedPhoto.url;
      out.style = calculatePreviewStyle({
        frame: state.frame,
        photo: photoBitmap,
        settings: state.settings[type],
      });
      out.meta = `${matchedPhoto.name} • ${type} (${normalizedIndex + 1}/${matches.length})`;
    } else {
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

export const calculatePreviewStyle = ({
  frame,
  photo,
  settings,
}: {
  frame: HTMLImageElement;
  photo: ImageBitmap;
  settings: CompositionSettings;
}): CSSProperties => {
  const frameDims: Dimensions = {
    width: frame.naturalWidth,
    height: frame.naturalHeight,
  };

  const orientedDims = {
    width: photo.width,
    height: photo.height,
  };
  const orientationType: OrientationType =
    orientedDims.height > orientedDims.width ? "portrait" : "landscape";

  const { width: targetWidth, height: targetHeight } = calculateTargetSize(
    frameDims,
    orientedDims,
    settings.scale,
    orientationType,
  );

  const centerX = (frameDims.width - targetWidth) / 2;
  const centerY = (frameDims.height - targetHeight) / 2;

  const panX = settings.pan.x * frameDims.width;
  const panY = settings.pan.y * frameDims.height;

  // Convert to percentages
  const left = ((centerX + panX) / frameDims.width) * 100;
  const top = ((centerY + panY) / frameDims.height) * 100;
  const width = (targetWidth / frameDims.width) * 100;
  const height = (targetHeight / frameDims.height) * 100;

  return {
    position: "absolute",
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
    objectFit: "fill",
    zIndex: 10,
    pointerEvents: "none",
  };
};
