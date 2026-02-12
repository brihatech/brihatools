export type ExportQuality = "low" | "medium" | "high";

export const EXPORT_QUALITY_SCALE: Record<ExportQuality, number> = {
  low: 1.2,
  medium: 2,
  high: 5,
};

export const PREVIEW_ORIENTATIONS = ["portrait", "landscape"] as const;
export type PreviewOrientation = (typeof PREVIEW_ORIENTATIONS)[number];

export interface CompositionSettings {
  scale: number;
  offset: number;
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
}

export interface PreviewIndex {
  portrait: number;
  landscape: number;
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
  frame: null,
  frameBitmap: null,
  photos: [],
  settings: {
    portrait: { scale: 0.7, offset: 0 },
    landscape: { scale: 0.9, offset: 0 },
  },
  exportQuality: "medium",
  previewIndex: {
    portrait: 0,
    landscape: 0,
  },
  isProcessing: false,
});

export const resetPreviewIndices = (state: PhotoFramerState) => {
  state.previewIndex.portrait = 0;
  state.previewIndex.landscape = 0;
};

export const normalizePreviewIndex = (index: number, total: number) => {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
};

export const getExportScale = (quality: ExportQuality) =>
  EXPORT_QUALITY_SCALE[quality];
