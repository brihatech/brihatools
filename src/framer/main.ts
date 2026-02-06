import { getExifOrientation } from "@/lib/exif";
import {
  calculateTargetSize,
  type Dimensions,
  type OrientationType,
} from "@/lib/image";

import { createOrientedBitmap } from "../lib/canvas";

type ExportQuality = "low" | "medium" | "high";

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
  image?: HTMLImageElement;
  bitmap?: ImageBitmap; // Pre-oriented cache
  orientation?: number;
}

export interface CompositionSettings {
  scale: number;
  offset: number;
}

export interface RenderContext {
  frame: HTMLImageElement;
  photo: CanvasImageSource;
  orientation: number;
  settings: CompositionSettings;
}

interface PhotoFramerUI {
  frameInput: HTMLInputElement;
  photoInput: HTMLInputElement;
  photoList: HTMLDivElement;
  portraitCanvas: HTMLCanvasElement;
  landscapeCanvas: HTMLCanvasElement;
  portraitMeta: HTMLElement;
  landscapeMeta: HTMLElement;
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
    isProcessing: false,
  };

  private ui!: PhotoFramerUI;
  private renderDebounceTimer: number | null = null;

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
      photoList: document.getElementById("photoList") as HTMLDivElement,
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
    });

    this.state.photos = files.map((file: File) => ({
      file,
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    this.ui.photoStatus.textContent = `${this.state.photos.length} photos selected`;
    this.ui.photoList.innerHTML = this.state.photos
      .map(
        (p) => `
        <div class="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100 photo-thumb">
          <img src="${p.url}" class="h-full w-full object-cover" loading="lazy" />
        </div>
      `,
      )
      .join("");

    this.renderPreviews();
  }

  private async ensurePhotoReady(photo: PhotoItem) {
    if (!photo.orientation) {
      photo.orientation = await getExifOrientation(photo.file);
    }
    if (!photo.bitmap) {
      photo.bitmap = await createOrientedBitmap(photo.file, photo.orientation);
    }
    return photo;
  }

  private compose(ctx: CanvasRenderingContext2D, data: RenderContext) {
    const frameDims: Dimensions = {
      width: data.frame.naturalWidth,
      height: data.frame.naturalHeight,
    };

    const bitmap = data.photo as ImageBitmap;
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

  private async renderPreviews() {
    if (!this.state.frame) {
      [this.ui.portraitCanvas, this.ui.landscapeCanvas].forEach((c) => {
        c.width = 1;
        c.height = 1;
        c.getContext("2d")?.clearRect(0, 0, 1, 1);
      });
      this.ui.portraitMeta.textContent = this.ui.landscapeMeta.textContent =
        "Upload a frame to begin";
      this.ui.downloadBtn.disabled = true;
      return;
    }

    for (const type of ["portrait", "landscape"] as const) {
      const canvas =
        type === "portrait" ? this.ui.portraitCanvas : this.ui.landscapeCanvas;
      const meta =
        type === "portrait" ? this.ui.portraitMeta : this.ui.landscapeMeta;
      const ctx = canvas.getContext("2d")!;

      let matchedPhoto: PhotoItem | undefined;
      for (const p of this.state.photos) {
        await this.ensurePhotoReady(p);
        const bitmap = p.bitmap;
        if (bitmap) {
          const pType = bitmap.height > bitmap.width ? "portrait" : "landscape";
          if (pType === type) {
            matchedPhoto = p;
            break;
          }
        }
      }

      canvas.width = this.state.frame.naturalWidth;
      canvas.height = this.state.frame.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (matchedPhoto?.bitmap) {
        this.compose(ctx, {
          frame: this.state.frame,
          photo: matchedPhoto.bitmap,
          orientation: matchedPhoto.orientation!,
          settings: this.state.settings[type],
        });
        meta.textContent = `${matchedPhoto.name} • ${type}`;
      } else {
        ctx.drawImage(this.state.frame, 0, 0);
        meta.textContent = `No ${type} photos selected`;
      }
    }

    this.ui.downloadBtn.disabled =
      this.state.photos.length === 0 || this.state.isProcessing;
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
    const photosData = [];
    for (const photo of this.state.photos) {
      await this.ensurePhotoReady(photo);
      // We need to create NEW bitmaps to transfer them to the worker
      const bitmap = await createImageBitmap(photo.bitmap!);
      photosData.push({
        name: photo.name,
        bitmap,
        orientation: photo.orientation!,
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
