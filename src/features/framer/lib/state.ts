export type ExportQuality = "low" | "medium" | "high";

export const EXPORT_QUALITY_SCALE: Record<ExportQuality, number> = {
  high: 5,
  low: 1.2,
  medium: 2,
};

export const PREVIEW_ORIENTATIONS = [
  "portrait",
  "landscape",
  "square",
] as const;
export type PreviewOrientation = (typeof PREVIEW_ORIENTATIONS)[number];

export interface CompositionSettings {
  scale: number;
  pan: { x: number; y: number };
}

export interface PhotoItem {
  file: File;
  name: string;
  url: string;
  bitmap?: ImageBitmap;
  orientation?: PreviewOrientation;
  bitmapPromise?: Promise<ImageBitmap>;
}

export interface PreviewSettings {
  portrait: CompositionSettings;
  landscape: CompositionSettings;
  square: CompositionSettings;
}

export interface PreviewIndex {
  portrait: number;
  landscape: number;
  square: number;
}

export interface PhotoFramerState {
  frame: HTMLImageElement | null;
  frameBitmap: ImageBitmap | null;
  photos: PhotoItem[];
  settings: PreviewSettings;
  exportQuality: ExportQuality;
  previewIndex: PreviewIndex;
  isProcessing: boolean;
}

export const createInitialState = (): PhotoFramerState => ({
  exportQuality: "medium",
  frame: null,
  frameBitmap: null,
  isProcessing: false,
  photos: [],
  previewIndex: {
    landscape: 0,
    portrait: 0,
    square: 0,
  },
  settings: {
    landscape: { pan: { x: 0, y: 0 }, scale: 0.9 },
    portrait: { pan: { x: 0, y: 0 }, scale: 0.7 },
    square: { pan: { x: 0, y: 0 }, scale: 0.8 },
  },
});

export const resetPreviewIndices = (state: PhotoFramerState) => {
  state.previewIndex.portrait = 0;
  state.previewIndex.landscape = 0;
  state.previewIndex.square = 0;
};

export const normalizePreviewIndex = (index: number, total: number) => {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
};

export const getExportScale = (quality: ExportQuality) =>
  EXPORT_QUALITY_SCALE[quality];
