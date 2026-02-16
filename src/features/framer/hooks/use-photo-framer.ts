import { useCallback, useEffect, useRef, useState } from "react";

import { handleDownload } from "../lib/downloader";
import { loadFrame } from "../lib/frame-loader";
import { createPhotoManager, type PhotoManager } from "../lib/photo-loader";
import { getPreviewState, type PreviewUiState } from "../lib/preview-renderer";
import {
  createInitialState,
  type ExportQuality,
  type PhotoFramerState,
  type PreviewOrientation,
  resetPreviewIndices,
} from "../lib/state";

export function usePhotoFramer() {
  const [state, setReactState] = useState<PhotoFramerState>(createInitialState);
  const stateRef = useRef(state);

  const setState = useCallback(
    (
      action: PhotoFramerState | ((prev: PhotoFramerState) => PhotoFramerState),
    ) => {
      const next =
        typeof action === "function"
          ? (action as (prev: PhotoFramerState) => PhotoFramerState)(
              stateRef.current,
            )
          : action;
      stateRef.current = next;
      setReactState(next);
    },
    [],
  );

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

  const photoManagerRef = useRef<PhotoManager | null>(null);
  const renderTimerRef = useRef<number | null>(null);

  const requestPreview = useCallback(() => {
    if (renderTimerRef.current) {
      cancelAnimationFrame(renderTimerRef.current);
    }
    renderTimerRef.current = requestAnimationFrame(() => {
      const s = stateRef.current;
      const pm = photoManagerRef.current;
      if (!pm) return;

      const result = getPreviewState({
        anyReady: () => pm.anyReady(),
        grouped: pm.groupPhotosByOrientation(),
        pendingCount: pm.getPendingCount(),
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
  }, [requestPreview, setState]);

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
    [requestPreview, setState],
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
    [requestPreview, setState],
  );

  const setExportQuality = useCallback(
    (quality: ExportQuality) => {
      setState((prev) => ({ ...prev, exportQuality: quality }));
    },
    [setState],
  );

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
    [requestPreview, setState],
  );

  const setPortraitPan = useCallback(
    (pan: { x: number; y: number }) => {
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          portrait: { ...prev.settings.portrait, pan },
        },
      }));
      requestPreview();
    },
    [requestPreview, setState],
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
    [requestPreview, setState],
  );

  const setLandscapePan = useCallback(
    (pan: { x: number; y: number }) => {
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          landscape: { ...prev.settings.landscape, pan },
        },
      }));
      requestPreview();
    },
    [requestPreview, setState],
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
  }, [requestPreview, setState]);

  return {
    cyclePreview,
    downloadStatus,
    downloadZip,
    frameStatus,
    onFrameChange,
    onPhotosChange,
    photoStatus,
    setExportQuality,
    setLandscapePan,
    setLandscapeScale,
    setPortraitPan,
    setPortraitScale,
    state,
    uiState,
  };
}
