import { getAlpine, startAlpine } from "@/alpine";
import { enforcePosterOnlyHosts } from "@/hostRedirect";

import { handleDownload } from "./downloader";
import { loadFrame } from "./frameLoader";
import { createPhotoManager } from "./photoLoader";
import { renderPreviews } from "./previewRenderer";
import {
  createInitialState,
  type PreviewOrientation,
  resetPreviewIndices,
} from "./state";

enforcePosterOnlyHosts();

const Alpine = getAlpine();

Alpine.data("photoFramer", () => {
  const state = createInitialState();
  let renderDebounceTimer: number | null = null;

  const component = {
    state,

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
      this.requestPreview();
    },

    async onFrameChange(event: Event) {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        this.frameStatus = "No frame selected";
        state.frame = null;
        state.frameBitmap = null;
        this.requestPreview();
        return;
      }

      const name = await loadFrame(file, state);
      this.frameStatus = name ?? "No frame selected";
      this.requestPreview();
    },

    onPhotosChange(event: Event) {
      const files = (event.target as HTMLInputElement).files;
      photoManager.handleSelection(files);
    },

    cyclePreview(type: PreviewOrientation, delta: number) {
      state.previewIndex[type] += delta;
      this.requestPreview();
    },

    requestPreview() {
      if (renderDebounceTimer) {
        cancelAnimationFrame(renderDebounceTimer);
      }
      renderDebounceTimer = requestAnimationFrame(() => this.drawPreviews());
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
      if (!portraitCanvas || !landscapeCanvas) return;

      const uiState = renderPreviews({
        state,
        portraitCanvas,
        landscapeCanvas,
        grouped: photoManager.groupPhotosByOrientation(),
        pendingCount: photoManager.getPendingCount(),
        anyReady: () => photoManager.anyReady(),
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
      await handleDownload(state, photoManager, {
        onStatus: (text) => {
          this.downloadStatus = text;
        },
        onBusyChange: (busy) => {
          state.isProcessing = busy;
          this.downloadDisabled = busy || this.downloadDisabled;
        },
      });

      this.requestPreview();
    },
  };

  const photoManager = createPhotoManager(state, {
    onStatus: (text) => {
      component.photoStatus = text;
    },
    onPhotosChanged: () => {
      resetPreviewIndices(state);
    },
    requestRender: () => component.requestPreview(),
  });

  return component;
});

startAlpine();
