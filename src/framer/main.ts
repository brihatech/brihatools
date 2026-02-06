import {
  calculateTargetSize,
  type Dimensions,
  type OrientationType,
} from "@/lib/image";

type ExportQuality = "low" | "medium" | "high";
const PREVIEW_ORIENTATIONS = ["portrait", "landscape"] as const;
type PreviewOrientation = (typeof PREVIEW_ORIENTATIONS)[number];

const EXPORT_QUALITY_SCALE: Record<ExportQuality, number> = {
  low: 1.2,
  medium: 2,
  high: 5,
};

// --- Types ---
interface PhotoItem {
  file: File;
  name: string;
  url: string;
  bitmap?: ImageBitmap;
  orientation?: PreviewOrientation;
  bitmapPromise?: Promise<ImageBitmap>;
}

export interface CompositionSettings {
  scale: number;
  offset: number;
}

export interface RenderContext {
  frame: HTMLImageElement;
  photo: ImageBitmap;
  settings: CompositionSettings;
}

interface PhotoFramerUI {
  frameInput: HTMLInputElement;
  photoInput: HTMLInputElement;
  portraitCanvas: HTMLCanvasElement;
  landscapeCanvas: HTMLCanvasElement;
  portraitMeta: HTMLElement;
  landscapeMeta: HTMLElement;
  portraitLoading: HTMLDivElement;
  landscapeLoading: HTMLDivElement;
  portraitPrevBtn: HTMLButtonElement;
  portraitNextBtn: HTMLButtonElement;
  landscapePrevBtn: HTMLButtonElement;
  landscapeNextBtn: HTMLButtonElement;
  downloadBtn: HTMLButtonElement;
  status: HTMLDivElement;
  frameStatus: HTMLElement;
  photoStatus: HTMLElement;
  qualitySelect: HTMLSelectElement;
  sliders: {
    portraitScale: HTMLInputElement;
    portraitOffset: HTMLInputElement;
    landscapeScale: HTMLInputElement;
    landscapeOffset: HTMLInputElement;
  };
  labels: {
    portraitScale: HTMLSpanElement;
    portraitOffset: HTMLSpanElement;
    landscapeScale: HTMLSpanElement;
    landscapeOffset: HTMLSpanElement;
  };
}

class PhotoFramer {
  private state = {
    frame: null as HTMLImageElement | null,
    frameBitmap: null as ImageBitmap | null,
    photos: [] as PhotoItem[],
    settings: {
      portrait: { scale: 0.7, offset: 0 },
      landscape: { scale: 0.9, offset: 0 },
    },
    exportQuality: "medium" as ExportQuality,
    previewIndex: {
      portrait: 0,
      landscape: 0,
    },
    isProcessing: false,
  };

  private ui!: PhotoFramerUI;
  private renderDebounceTimer: number | null = null;
  private currentPhotoLoadToken = 0;

  constructor() {
    this.initUI();
    this.bindEvents();
    this.updateLabels();
    this.renderPreviews();
  }

  private initUI() {
    this.ui = {
      frameInput: document.getElementById("frameInput") as HTMLInputElement,
      photoInput: document.getElementById("photoInput") as HTMLInputElement,
      portraitCanvas: document.getElementById(
        "portraitPreviewCanvas",
      ) as HTMLCanvasElement,
      landscapeCanvas: document.getElementById(
        "landscapePreviewCanvas",
      ) as HTMLCanvasElement,
      portraitMeta: document.getElementById(
        "portraitPreviewMeta",
      ) as HTMLElement,
      landscapeMeta: document.getElementById(
        "landscapePreviewMeta",
      ) as HTMLElement,
      portraitLoading: document.getElementById(
        "portraitLoading",
      ) as HTMLDivElement,
      landscapeLoading: document.getElementById(
        "landscapeLoading",
      ) as HTMLDivElement,
      portraitPrevBtn: document.getElementById(
        "portraitPrev",
      ) as HTMLButtonElement,
      portraitNextBtn: document.getElementById(
        "portraitNext",
      ) as HTMLButtonElement,
      landscapePrevBtn: document.getElementById(
        "landscapePrev",
      ) as HTMLButtonElement,
      landscapeNextBtn: document.getElementById(
        "landscapeNext",
      ) as HTMLButtonElement,
      downloadBtn: document.getElementById("downloadZip") as HTMLButtonElement,
      status: document.getElementById("downloadStatus") as HTMLDivElement,
      frameStatus: document.getElementById("frameStatus") as HTMLElement,
      photoStatus: document.getElementById("photoStatus") as HTMLElement,
      qualitySelect: document.getElementById(
        "exportQuality",
      ) as HTMLSelectElement,
      sliders: {
        portraitScale: document.getElementById(
          "portraitScale",
        ) as HTMLInputElement,
        portraitOffset: document.getElementById(
          "portraitOffset",
        ) as HTMLInputElement,
        landscapeScale: document.getElementById(
          "landscapeScale",
        ) as HTMLInputElement,
        landscapeOffset: document.getElementById(
          "landscapeOffset",
        ) as HTMLInputElement,
      },
      labels: {
        portraitScale: document.getElementById(
          "portraitScaleValue",
        ) as HTMLSpanElement,
        portraitOffset: document.getElementById(
          "portraitOffsetValue",
        ) as HTMLSpanElement,
        landscapeScale: document.getElementById(
          "landscapeScaleValue",
        ) as HTMLSpanElement,
        landscapeOffset: document.getElementById(
          "landscapeOffsetValue",
        ) as HTMLSpanElement,
      },
    };

    this.ui.qualitySelect.value = this.state.exportQuality;
  }

  private bindEvents() {
    this.ui.frameInput.addEventListener("change", () =>
      this.handleFrameUpload(),
    );
    this.ui.photoInput.addEventListener("change", () =>
      this.handlePhotosUpload(),
    );
    this.ui.downloadBtn.addEventListener("click", () => this.handleDownload());
    this.ui.qualitySelect.addEventListener("change", (e: Event) => {
      const next = (e.target as HTMLSelectElement).value as ExportQuality;
      this.state.exportQuality = next;
    });
    this.ui.portraitPrevBtn.addEventListener("click", () =>
      this.cyclePreview("portrait", -1),
    );
    this.ui.portraitNextBtn.addEventListener("click", () =>
      this.cyclePreview("portrait", 1),
    );
    this.ui.landscapePrevBtn.addEventListener("click", () =>
      this.cyclePreview("landscape", -1),
    );
    this.ui.landscapeNextBtn.addEventListener("click", () =>
      this.cyclePreview("landscape", 1),
    );

    const sliderMap: Record<
      string,
      { type: "portrait" | "landscape"; field: "scale" | "offset" }
    > = {
      portraitScale: { type: "portrait", field: "scale" },
      portraitOffset: { type: "portrait", field: "offset" },
      landscapeScale: { type: "landscape", field: "scale" },
      landscapeOffset: { type: "landscape", field: "offset" },
    };

    Object.entries(this.ui.sliders).forEach(([key, input]) => {
      input.addEventListener("input", (e: Event) => {
        const config = sliderMap[key];
        if (config) {
          const val = Number((e.target as HTMLInputElement).value);
          this.state.settings[config.type][config.field] = val;
          this.updateLabels();
          this.requestPreview();
        }
      });
    });
  }

  private requestPreview() {
    if (this.renderDebounceTimer)
      cancelAnimationFrame(this.renderDebounceTimer);
    this.renderDebounceTimer = requestAnimationFrame(() =>
      this.renderPreviews(),
    );
  }

  private async handleFrameUpload() {
    const file = this.ui.frameInput.files?.[0];
    if (!file) return;

    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    this.state.frame = img;
    this.state.frameBitmap = await createImageBitmap(img);
    this.ui.frameStatus.textContent = file.name;
    this.renderPreviews();
  }

  private async handlePhotosUpload() {
    const files = Array.from(this.ui.photoInput.files ?? []);
    this.state.photos.forEach((p) => {
      URL.revokeObjectURL(p.url);
      p.bitmap?.close();
      p.bitmapPromise = undefined;
    });

    this.state.photos = files.map((file: File) => ({
      file,
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    this.ui.photoStatus.textContent = `${this.state.photos.length} photos selected`;
    this.resetPreviewIndices();
    this.renderPreviews();

    if (this.state.photos.length === 0) return;

    const loadToken = ++this.currentPhotoLoadToken;
    void this.loadPhotosInBackground(loadToken);
  }

  private async loadPhotosInBackground(loadToken: number) {
    const BATCH_SIZE = 3;
    const total = this.state.photos.length;
    if (total === 0) return;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      if (loadToken !== this.currentPhotoLoadToken) return;

      const batch = this.state.photos.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((photo) => this.ensurePhotoReady(photo)));

      if (loadToken !== this.currentPhotoLoadToken) return;

      const loaded = this.state.photos.filter((p) => p.bitmap).length;
      this.ui.photoStatus.textContent =
        loaded === total
          ? `${total} photos ready`
          : `Loading... ${loaded}/${total}`;
      this.renderPreviews();
    }

    if (loadToken === this.currentPhotoLoadToken) {
      this.ui.photoStatus.textContent = `${this.state.photos.length} photos ready`;
      this.renderPreviews();
    }
  }

  private async ensurePhotoReady(photo: PhotoItem) {
    if (photo.bitmap) return photo.bitmap;
    if (!photo.bitmapPromise) {
      photo.bitmapPromise = createImageBitmap(photo.file).then((bitmap) => {
        photo.bitmap = bitmap;
        photo.orientation =
          bitmap.height > bitmap.width ? "portrait" : "landscape";
        photo.bitmapPromise = undefined;
        return bitmap;
      });
    }
    return photo.bitmapPromise;
  }

  private cyclePreview(type: PreviewOrientation, delta: number) {
    this.state.previewIndex[type] += delta;
    void this.renderPreviews();
  }

  private resetPreviewIndices() {
    this.state.previewIndex.portrait = 0;
    this.state.previewIndex.landscape = 0;
  }

  private getNavButtons(type: PreviewOrientation) {
    if (type === "portrait") {
      return {
        prev: this.ui.portraitPrevBtn,
        next: this.ui.portraitNextBtn,
      };
    }
    return {
      prev: this.ui.landscapePrevBtn,
      next: this.ui.landscapeNextBtn,
    };
  }

  private setNavState(type: PreviewOrientation, count: number) {
    const { prev, next } = this.getNavButtons(type);
    const disabled = count <= 1;
    prev.disabled = disabled;
    next.disabled = disabled;
  }

  private getLoadingElement(type: PreviewOrientation) {
    return type === "portrait"
      ? this.ui.portraitLoading
      : this.ui.landscapeLoading;
  }

  private setPreviewLoading(type: PreviewOrientation, isLoading: boolean) {
    this.getLoadingElement(type).classList.toggle("active", isLoading);
  }

  private normalizePreviewIndex(index: number, total: number) {
    if (total <= 0) return 0;
    const normalized = ((index % total) + total) % total;
    return normalized;
  }

  private groupPhotosByOrientationNonBlocking() {
    const grouped: Record<PreviewOrientation, PhotoItem[]> = {
      portrait: [],
      landscape: [],
    };

    for (const photo of this.state.photos) {
      if (!photo.orientation) continue;
      grouped[photo.orientation].push(photo);
    }

    return grouped;
  }

  private compose(ctx: CanvasRenderingContext2D, data: RenderContext) {
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
    // Use the pre-oriented bitmap directly
    ctx.drawImage(
      bitmap,
      centerX,
      centerY + offsetValue,
      targetWidth,
      targetHeight,
    );
  }

  private updateLabels() {
    this.ui.labels.portraitScale.textContent =
      this.state.settings.portrait.scale.toFixed(2);
    this.ui.labels.portraitOffset.textContent =
      this.state.settings.portrait.offset.toFixed(2);
    this.ui.labels.landscapeScale.textContent =
      this.state.settings.landscape.scale.toFixed(2);
    this.ui.labels.landscapeOffset.textContent =
      this.state.settings.landscape.offset.toFixed(2);
  }

  private getExportScale() {
    return EXPORT_QUALITY_SCALE[this.state.exportQuality];
  }

  private renderPreviews() {
    if (!this.state.frame) {
      [this.ui.portraitCanvas, this.ui.landscapeCanvas].forEach((c) => {
        c.width = 1;
        c.height = 1;
        c.getContext("2d")?.clearRect(0, 0, 1, 1);
      });
      this.ui.portraitMeta.textContent = this.ui.landscapeMeta.textContent =
        "Upload a frame to begin";
      PREVIEW_ORIENTATIONS.forEach((type) => {
        this.setNavState(type, 0);
        this.setPreviewLoading(type, false);
      });
      this.ui.downloadBtn.disabled = true;
      return;
    }

    const grouped = this.groupPhotosByOrientationNonBlocking();
    const pendingPhotos = this.state.photos.filter((p) => !p.bitmap).length;

    for (const type of PREVIEW_ORIENTATIONS) {
      const canvas =
        type === "portrait" ? this.ui.portraitCanvas : this.ui.landscapeCanvas;
      const meta =
        type === "portrait" ? this.ui.portraitMeta : this.ui.landscapeMeta;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      const matches = grouped[type];
      this.setNavState(type, matches.length);
      const isTypeLoading =
        matches.length === 0 &&
        this.state.photos.length > 0 &&
        pendingPhotos > 0;

      canvas.width = this.state.frame.naturalWidth;
      canvas.height = this.state.frame.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (matches.length > 0) {
        const normalizedIndex = this.normalizePreviewIndex(
          this.state.previewIndex[type],
          matches.length,
        );
        this.state.previewIndex[type] = normalizedIndex;
        const matchedPhoto = matches[normalizedIndex];
        const photoBitmap = matchedPhoto.bitmap;
        if (!photoBitmap) {
          this.setPreviewLoading(type, true);
          meta.textContent = `Loading ${matchedPhoto.name}...`;
          ctx.drawImage(this.state.frame, 0, 0);
          continue;
        }
        this.setPreviewLoading(type, false);
        this.compose(ctx, {
          frame: this.state.frame,
          photo: photoBitmap,
          settings: this.state.settings[type],
        });
        meta.textContent = `${matchedPhoto.name} • ${type} (${normalizedIndex + 1}/${matches.length})`;
      } else {
        ctx.drawImage(this.state.frame, 0, 0);
        if (isTypeLoading) {
          this.setPreviewLoading(type, true);
          meta.textContent = `Loading ${type} photos...`;
        } else {
          this.setPreviewLoading(type, false);
          meta.textContent =
            this.state.photos.length === 0
              ? "Upload photos to preview"
              : `No ${type} photos selected`;
        }
      }
    }

    const anyReady = this.state.photos.some((p) => p.bitmap);
    this.ui.downloadBtn.disabled = !anyReady || this.state.isProcessing;
  }

  private async handleDownload() {
    if (
      !this.state.frameBitmap ||
      this.state.photos.length === 0 ||
      this.state.isProcessing
    )
      return;

    this.state.isProcessing = true;
    this.ui.downloadBtn.disabled = true;
    this.ui.status.textContent = "Preparing photos...";

    // Create a worker
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });

    // Prepare data for worker
    const photosData: Array<{ name: string; bitmap: ImageBitmap }> = [];
    for (const photo of this.state.photos) {
      const readyBitmap = await this.ensurePhotoReady(photo);
      // We need to create NEW bitmaps to transfer them to the worker
      const bitmap = await createImageBitmap(readyBitmap);
      photosData.push({
        name: photo.name,
        bitmap,
      });
    }

    const frameBitmap = await createImageBitmap(this.state.frameBitmap);

    worker.onmessage = (e) => {
      const { type, current, total, blob } = e.data;
      if (type === "progress") {
        this.ui.status.textContent = `Processing ${current}/${total}...`;
      } else if (type === "complete") {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "framed-photos.zip";
        link.click();

        this.ui.status.textContent = "Done!";
        this.state.isProcessing = false;
        this.ui.downloadBtn.disabled = false;
        worker.terminate();
      }
    };

    // Transfer bitmaps to worker
    const transferables = [frameBitmap, ...photosData.map((p) => p.bitmap)];
    worker.postMessage(
      {
        frame: frameBitmap,
        photos: photosData,
        settings: this.state.settings,
        exportScale: this.getExportScale(),
      },
      transferables,
    );
  }
}

new PhotoFramer();
