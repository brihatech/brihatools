import { useCallback, useEffect, useRef, useState } from "react";

import { handleDownload } from "../lib/downloader";
import { loadFrame } from "../lib/frame-loader";
import { createPhotoManager, type PhotoManager } from "../lib/photo-loader";
import { type PreviewUiState, renderPreviews } from "../lib/preview-renderer";
import {
  createInitialState,
  type ExportQuality,
  type PhotoFramerState,
  type PreviewOrientation,
  resetPreviewIndices,
} from "../lib/state";

export function usePhotoFramer() {
  const [state, setState] = useState<PhotoFramerState>(createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [frameStatus, setFrameStatus] = useState("No frame selected");
  const [photoStatus, setPhotoStatus] = useState("No photos selected");
  const [downloadStatus, setDownloadStatus] = useState("");

  const [uiState, setUiState] = useState<PreviewUiState>({
    downloadDisabled: true,
    landscape: {
      count: 0,
      index: 0,
      isLoading: false,
      meta: "Upload frame & landscape photos",
      navDisabled: true,
    },
    portrait: {
      count: 0,
      index: 0,
      isLoading: false,
      meta: "Upload frame & portrait photos",
      navDisabled: true,
    },
  });

  const portraitCanvasRef = useRef<HTMLCanvasElement>(null);
  const landscapeCanvasRef = useRef<HTMLCanvasElement>(null);
  const photoManagerRef = useRef<PhotoManager | null>(null);
  const renderTimerRef = useRef<number | null>(null);

  const requestPreview = useCallback(() => {
    if (renderTimerRef.current) {
      cancelAnimationFrame(renderTimerRef.current);
    }
    renderTimerRef.current = requestAnimationFrame(() => {
      const s = stateRef.current;
      const portraitCanvas = portraitCanvasRef.current;
      const landscapeCanvas = landscapeCanvasRef.current;
      const pm = photoManagerRef.current;
      if (!portraitCanvas || !landscapeCanvas || !pm) return;

      const result = renderPreviews({
        anyReady: () => pm.anyReady(),
        grouped: pm.groupPhotosByOrientation(),
        landscapeCanvas,
        pendingCount: pm.getPendingCount(),
        portraitCanvas,
        state: s,
      });

      setUiState(result);
    });
  }, []);

  useEffect(() => {
    photoManagerRef.current = createPhotoManager(stateRef.current, {
      onPhotosChanged: () => {
        setState((prev) => {
          const next = { ...prev };
          resetPreviewIndices(next);
          return next;
        });
      },
      onStatus: setPhotoStatus,
      requestRender: requestPreview,
    });
    requestPreview();
  }, [requestPreview]);

  const onFrameChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        setFrameStatus("No frame selected");
        setState((prev) => ({ ...prev, frame: null, frameBitmap: null }));
        requestPreview();
        return;
      }

      const name = await loadFrame(file, stateRef.current);
      setState({ ...stateRef.current });
      setFrameStatus(name ?? "No frame selected");
      requestPreview();
    },
    [requestPreview],
  );

  const onPhotosChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      photoManagerRef.current?.handleSelection(event.target.files);
    },
    [],
  );

  const cyclePreview = useCallback(
    (type: PreviewOrientation, delta: number) => {
      setState((prev) => {
        const next = { ...prev, previewIndex: { ...prev.previewIndex } };
        next.previewIndex[type] += delta;
        return next;
      });
      requestPreview();
    },
    [requestPreview],
  );

  const setExportQuality = useCallback((quality: ExportQuality) => {
    setState((prev) => ({ ...prev, exportQuality: quality }));
  }, []);

  const setPortraitScale = useCallback(
    (value: number) => {
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          portrait: { ...prev.settings.portrait, scale: value },
        },
      }));
      requestPreview();
    },
    [requestPreview],
  );

  const setPortraitOffset = useCallback(
    (value: number) => {
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          portrait: { ...prev.settings.portrait, offset: value },
        },
      }));
      requestPreview();
    },
    [requestPreview],
  );

  const setLandscapeScale = useCallback(
    (value: number) => {
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          landscape: { ...prev.settings.landscape, scale: value },
        },
      }));
      requestPreview();
    },
    [requestPreview],
  );

  const setLandscapeOffset = useCallback(
    (value: number) => {
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          landscape: { ...prev.settings.landscape, offset: value },
        },
      }));
      requestPreview();
    },
    [requestPreview],
  );

  const downloadZip = useCallback(async () => {
    const pm = photoManagerRef.current;
    if (!pm) return;

    await handleDownload(stateRef.current, pm, {
      onBusyChange: (busy) => {
        setState((prev) => ({ ...prev, isProcessing: busy }));
      },
      onStatus: setDownloadStatus,
    });

    requestPreview();
  }, [requestPreview]);

  return {
    cyclePreview,
    downloadStatus,
    downloadZip,
    frameStatus,
    landscapeCanvasRef,
    onFrameChange,
    onPhotosChange,
    photoStatus,
    portraitCanvasRef,
    setExportQuality,
    setLandscapeOffset,
    setLandscapeScale,
    setPortraitOffset,
    setPortraitScale,
    state,
    uiState,
  };
}
