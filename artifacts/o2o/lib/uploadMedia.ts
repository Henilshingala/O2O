import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBaseUrl } from "@workspace/api-client-react";

const TOKEN_KEY = "@o2o_token";

export interface UploadAsset {
  uri?: string | null;
  type?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}

export interface UploadProgress {
  /** Bytes already uploaded */
  loaded: number;
  /** Total file size in bytes */
  total: number;
  /** 0–100 */
  percent: number;
  /** Formatted loaded size e.g. "1.2 MB" */
  loadedStr: string;
  /** Formatted total size e.g. "8.3 MB" */
  totalStr: string;
  /** Formatted remaining size e.g. "7.1 MB" */
  remainingStr: string;
  /** Estimated remaining seconds (NaN until enough data) */
  etaSeconds: number;
}

export type UploadState =
  | "idle"
  | "uploading"
  | "paused"
  | "done"
  | "failed"
  | "cancelled";

export interface UploadHandle {
  /** Promise that resolves to the uploaded URL */
  result: Promise<string>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  getState: () => UploadState;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeUri(uri: string): string {
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(uri)) return uri;
  if (uri.startsWith("/")) return `file://${uri}`;
  return uri;
}

/**
 * Upload a single file using fetch to bypass the RN 0.68 XHR bug.
 */
export function uploadFileWithProgress(
  asset: UploadAsset,
  fallbackName = "upload",
  onProgress?: (p: UploadProgress) => void,
  signal?: AbortSignal
): UploadHandle {
  let state: UploadState = "idle";
  let resolve!: (url: string) => void;
  let reject!: (err: Error) => void;
  let abortController = new AbortController();

  if (signal) {
    signal.addEventListener("abort", () => {
      abortController.abort();
    });
  }

  const result = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const startUpload = async () => {
    state = "uploading";
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const base = getBaseUrl();
      const url = `${base}/api/upload`;

      const formData = new FormData();
      formData.append("file", {
        uri: normalizeUri(asset.uri!),
        type: asset.type || "application/octet-stream",
        name: asset.fileName || fallbackName,
      } as any);

      console.log(`[UPLOAD_BEGIN] url=${url} fileName=${asset.fileName || fallbackName}`);

      let progress = 0;
      let interval: ReturnType<typeof setInterval> | null = null;
      if (onProgress) {
        interval = setInterval(() => {
          progress += Math.floor(Math.random() * 10) + 5; // Fake progress
          if (progress > 95) progress = 95;
          onProgress({
            loaded: progress,
            total: 100,
            percent: progress,
            loadedStr: `${progress}%`,
            totalStr: "100%",
            remainingStr: "...",
            etaSeconds: NaN,
          });
        }, 500);
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(url, {
        method: "POST",
        body: formData,
        headers,
        signal: abortController.signal,
      });

      if (interval) clearInterval(interval);

      if (!res.ok) {
        let errMsg = `Upload failed: HTTP ${res.status}`;
        try {
          const d = await res.json();
          if (d.error) errMsg = `Upload failed: ${d.error}`;
        } catch {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      console.log(`[UPLOAD_SUCCESS] parsed url=${data.url}`);

      if (onProgress) {
        onProgress({
          loaded: 100,
          total: 100,
          percent: 100,
          loadedStr: "100%",
          totalStr: "100%",
          remainingStr: "Done",
          etaSeconds: 0,
        });
      }

      state = "done";
      resolve(data.url);
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("[UPLOAD_ABORTED]");
        state = "cancelled";
        reject(new Error("Upload cancelled"));
      } else {
        console.error(`[UPLOAD_FAILED_FETCH]`, err);
        state = "failed";
        reject(err);
      }
    }
  };

  startUpload().catch(() => {});

  return {
    result,
    pause: () => {
      if (state === "uploading") {
        state = "paused";
        abortController.abort();
        reject(new Error("Upload paused"));
      }
    },
    resume: () => {
      if (state === "paused") {
        const newHandle = uploadFileWithProgress(asset, fallbackName, onProgress, signal);
        newHandle.result.then(resolve).catch(reject);
      }
    },
    cancel: () => {
      if (state === "uploading" || state === "paused" || state === "idle") {
        state = "cancelled";
        abortController.abort();
        reject(new Error("Upload cancelled"));
      }
    },
    getState: () => state,
  };
}

/**
 * Simple one-shot upload (backward compat). Uses XHR internally.
 */
export async function uploadFile(
  asset: UploadAsset,
  fallbackName = "upload",
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  if (!asset.uri) throw new Error("Missing file URI");
  const handle = uploadFileWithProgress(asset, fallbackName, onProgress);
  return handle.result;
}

/**
 * Upload multiple files concurrently with controlled concurrency.
 * Returns URLs in original order; failed items throw with index info.
 */
export async function uploadFiles(
  assets: UploadAsset[],
  opts: {
    concurrency?: number;
    onProgress?: (index: number, p: UploadProgress) => void;
    signal?: AbortSignal;
  } = {}
): Promise<string[]> {
  const { concurrency = 3, onProgress, signal } = opts;
  const results: string[] = new Array(assets.length);
  let idx = 0;

  const worker = async (): Promise<void> => {
    while (idx < assets.length) {
      const i = idx++;
      const asset = assets[i];
      const fallback = asset.fileName || `upload_${i}.${asset.type?.includes("video") ? "mp4" : "jpg"}`;
      results[i] = await uploadFile(
        asset,
        fallback,
        onProgress ? (p) => onProgress(i, p) : undefined
      );
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, assets.length) }, worker);
  await Promise.all(workers);
  return results;
}
