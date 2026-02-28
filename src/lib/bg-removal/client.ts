import { logError } from "@/lib/logger";

export type BackgroundRemovalQuality = "standard" | "hq";

let worker: Worker | null = null;
const pendingRequests = new Map<
  number,
  { resolve: (url: string) => void; reject: (err: Error) => void }
>();
let nextRequestId = 0;

const getWorker = () => {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (e) => {
      const { id, blob, error } = e.data;
      const request = pendingRequests.get(id);
      if (!request) return;

      pendingRequests.delete(id);

      if (error) {
        request.reject(new Error(error));
      } else {
        const url = URL.createObjectURL(blob);
        request.resolve(url);
      }
    };

    worker.onerror = (e) => {
      logError("poster.background.worker_error", e, {
        feature: "poster",
      });
    };
  }
  return worker;
};

// Boot the worker immediately on module import.
// The worker's own top-level code will start pre-warming the ONNX sessions,
// hiding model load time behind the user's natural think/upload time.
getWorker();

export async function removeBackground(
  photoSrc: string,
  quality: BackgroundRemovalQuality = "standard",
): Promise<string> {
  const worker = getWorker();
  const id = nextRequestId++;

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ photoSrc, quality, id });
  });
}
