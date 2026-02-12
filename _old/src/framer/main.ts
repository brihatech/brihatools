import { getAlpine, startAlpine } from "@/alpine";
import { enforcePosterOnlyHosts } from "@/hostRedirect";

import { handleDownload } from "./downloader";
import { loadFrame } from "./frameLoader";
import { createPhotoManager, type PhotoManager } from "./photoLoader";
import { renderPreviews } from "./previewRenderer";
import {
  createInitialState,
  type PreviewOrientation,
  resetPreviewIndices,
} from "./state";

enforcePosterOnlyHosts();

const Alpine = getAlpine();

Alpine.data("photoFramer", () => {
  return {
    state: createInitialState(),
    renderDebounceTimer: null as number | null,
    photoManager: null as PhotoManager | null,

    frameStatus: "No frame selected",
    photoStatus: "No photos selected",
    downloadStatus: "",

    portraitMeta: "Upload frame & portrait photos",
    landscapeMeta: "Upload frame & landscape photos",
    portraitLoading: false,
    landscapeLoading: false,

    portraitNavDisabled: true,
    landscapeNavDisabled: true,
    downloadDisabled: true,

    init() {
      // Initialize photoManager with the reactive state proxy (this.state)
      // and bind callbacks to the reactive component instance (this)
      this.photoManager = createPhotoManager(this.state, {
        onStatus: (text) => {
          this.photoStatus = text;
        },
        onPhotosChanged: () => {
          resetPreviewIndices(this.state);
        },
        requestRender: () => this.requestPreview(),
      });

      this.requestPreview();
    },

    async onFrameChange(event: Event) {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        this.frameStatus = "No frame selected";
        this.state.frame = null;
        this.state.frameBitmap = null;
        this.requestPreview();
        return;
      }

      const name = await loadFrame(file, this.state);
      this.frameStatus = name ?? "No frame selected";
      this.requestPreview();
    },

    onPhotosChange(event: Event) {
      const files = (event.target as HTMLInputElement).files;
      this.photoManager?.handleSelection(files);
    },

    cyclePreview(type: PreviewOrientation, delta: number) {
      this.state.previewIndex[type] += delta;
      this.requestPreview();
    },

    requestPreview() {
      if (this.renderDebounceTimer) {
        cancelAnimationFrame(this.renderDebounceTimer);
      }
      this.renderDebounceTimer = requestAnimationFrame(() =>
        this.drawPreviews(),
      );
    },

    drawPreviews() {
      const refs = (this as unknown as { $refs?: Record<string, unknown> })
        .$refs;
      const portraitCanvas = refs?.portraitCanvas as
        | HTMLCanvasElement
        | undefined;
      const landscapeCanvas = refs?.landscapeCanvas as
        | HTMLCanvasElement
        | undefined;
      if (!portraitCanvas || !landscapeCanvas || !this.photoManager) return;

      const uiState = renderPreviews({
        state: this.state,
        portraitCanvas,
        landscapeCanvas,
        grouped: this.photoManager.groupPhotosByOrientation(),
        pendingCount: this.photoManager.getPendingCount(),
        anyReady: () => this.photoManager?.anyReady(),
      });

      this.portraitMeta = uiState.portrait.meta;
      this.landscapeMeta = uiState.landscape.meta;
      this.portraitLoading = uiState.portrait.isLoading;
      this.landscapeLoading = uiState.landscape.isLoading;
      this.portraitNavDisabled = uiState.portrait.navDisabled;
      this.landscapeNavDisabled = uiState.landscape.navDisabled;
      this.downloadDisabled = uiState.downloadDisabled;
    },

    async downloadZip() {
      if (!this.photoManager) return;

      await handleDownload(this.state, this.photoManager, {
        onStatus: (text) => {
          this.downloadStatus = text;
        },
        onBusyChange: (busy) => {
          this.state.isProcessing = busy;
          this.downloadDisabled = busy || this.downloadDisabled;
        },
      });

      this.requestPreview();
    },
  };
});

startAlpine();
