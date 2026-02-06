import { handleDownload } from "./downloader";
import { loadFrame } from "./frameLoader";
import { createPhotoManager } from "./photoLoader";
import { renderPreviews as renderPreviewCanvas } from "./previewRenderer";
import {
  createInitialState,
  type ExportQuality,
  type PreviewOrientation,
  resetPreviewIndices,
} from "./state";
import { bindSliderInputs, initUI, updateLabels } from "./ui";

class PhotoFramer {
  private state = createInitialState();
  private ui = initUI();
  private photoManager = createPhotoManager(this.state, {
    onStatus: (text) => {
      this.ui.photoStatus.textContent = text;
    },
    onPhotosChanged: () => {
      resetPreviewIndices(this.state);
    },
    requestRender: () => this.requestPreview(),
  });
  private renderDebounceTimer: number | null = null;

  constructor() {
    this.ui.qualitySelect.value = this.state.exportQuality;
    bindSliderInputs(this.ui, this.state, () => {
      updateLabels(this.ui, this.state.settings);
      this.requestPreview();
    });
    this.bindEvents();
    updateLabels(this.ui, this.state.settings);
    this.requestPreview();
  }

  private bindEvents() {
    this.ui.frameInput.addEventListener("change", () => {
      const file = this.ui.frameInput.files?.[0];
      void loadFrame(file, this.state, this.ui, () => this.requestPreview());
    });

    this.ui.photoInput.addEventListener("change", () =>
      this.photoManager.handleSelection(this.ui.photoInput.files),
    );

    this.ui.downloadBtn.addEventListener("click", () =>
      handleDownload(this.state, this.ui, this.photoManager),
    );

    this.ui.qualitySelect.addEventListener("change", (event: Event) => {
      const next = (event.target as HTMLSelectElement).value as ExportQuality;
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
  }

  private cyclePreview(type: PreviewOrientation, delta: number) {
    this.state.previewIndex[type] += delta;
    this.requestPreview();
  }

  private requestPreview() {
    if (this.renderDebounceTimer) {
      cancelAnimationFrame(this.renderDebounceTimer);
    }
    this.renderDebounceTimer = requestAnimationFrame(() => this.drawPreviews());
  }

  private drawPreviews() {
    renderPreviewCanvas({
      state: this.state,
      ui: this.ui,
      grouped: this.photoManager.groupPhotosByOrientation(),
      pendingCount: this.photoManager.getPendingCount(),
      anyReady: () => this.photoManager.anyReady(),
    });
  }
}

new PhotoFramer();
