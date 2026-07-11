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

/**
 * Global emitter to bypass React Native HTTP bugs.
 * The server emits `upload:complete` via WebSockets, and we resolve it here.
 * Stored on `global` to survive Metro module re-evaluation.
 */
export const UploadEmitter = (global as any).UploadEmitter || {
  listeners: new Map<string, (url: string) => void>(),
  resolve: (uploadId: string, url: string) => {
    const cb = UploadEmitter.listeners.get(uploadId);
    if (cb) {
      console.log(`[UPLOAD_EMITTER] Socket resolved upload ${uploadId} -> ${url}`);
      cb(url);
      UploadEmitter.listeners.delete(uploadId);
    }
  },
};

if (!(global as any).UploadEmitter) {
  (global as any).UploadEmitter = UploadEmitter;
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
 * Upload a single file using XHR — the only transport that reliably delivers
 * an onload callback on Android with React Native 0.68 + FormData.
 *
 * The promise resolves via DUAL-PATH (whichever fires first):
 *   1. XHR onload  → parse HTTP 200 JSON and resolve
 *   2. WebSocket   → UploadEmitter.resolve() called from socket.ts
 *
 * This eliminates the "stuck at 95%" bug caused by fetch() silently dropping
 * the response body on Android's okhttp bridge.
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
  let xhr: XMLHttpRequest | null = null;
  let settled = false;

  // Guard: only the first call to settle() wins — prevents double-resolve.
  const settle = (fn: () => void) => {
    if (settled) return;
    settled = true;
    fn();
  };

  const result = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  if (signal) {
    signal.addEventListener("abort", () => {
      if (state === "uploading" || state === "idle") {
        state = "cancelled";
        xhr?.abort();
        settle(() => reject(new Error("Upload cancelled")));
      }
    });
  }

  const startUpload = async () => {
    state = "uploading";
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const base = getBaseUrl();
      const url = `${base}/api/upload`;

      const formData = new FormData();
      const uploadId = `up_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      formData.append("uploadId", uploadId);

      // RN 0.68 FormData bug: spaces/special chars in filename corrupt the boundary.
      const safeExt = asset.type?.includes("video") ? ".mp4" : ".jpg";
      const safeFileName = `upload_${Date.now()}${safeExt}`;

      formData.append("file", {
        uri: normalizeUri(asset.uri!),
        type: asset.type || "application/octet-stream",
        name: safeFileName,
      } as any);

      // ── WebSocket path (path #2) ──────────────────────────────────────────
      // If the socket event fires first, resolve and abort the pending XHR.
      UploadEmitter.listeners.set(uploadId, (completedUrl: string) => {
        if (state === "uploading") {
          state = "done";
          if (onProgress) {
            onProgress({
              loaded: 100, total: 100, percent: 100,
              loadedStr: "100%", totalStr: "100%", remainingStr: "Done", etaSeconds: 0,
            });
          }
          xhr?.abort(); // cancel pending XHR — the socket already gave us the URL
          settle(() => resolve(completedUrl));
        }
      });

      // 90-second hard timeout — abort both paths if neither resolves.
      const timeout = setTimeout(() => {
        if (state === "uploading") {
          console.error(`[UPLOAD_TIMEOUT] No response after 90s for ${uploadId}`);
          UploadEmitter.listeners.delete(uploadId);
          xhr?.abort();
          state = "failed";
          settle(() => reject(new Error("Upload timed out after 90 seconds")));
        }
      }, 90000);

      console.log(`[UPLOAD_BEGIN] url=${url} uploadId=${uploadId} fileName=${safeFileName}`);

      // ── XHR path (path #1) ────────────────────────────────────────────────
      xhr = new XMLHttpRequest();
      xhr.open("POST", url);

      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("Accept", "application/json");

      // Real XHR upload progress events — no fake interval needed.
      if (onProgress && xhr.upload) {
        const startTime = Date.now();
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          // Cap at 95% — the final 5% closes when onload fires
          const percent = Math.min(95, Math.round((event.loaded / event.total) * 100));
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = event.loaded / (elapsed || 1);
          const remaining = (event.total - event.loaded) / (speed || 1);
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percent,
            loadedStr: formatBytes(event.loaded),
            totalStr: formatBytes(event.total),
            remainingStr: formatBytes(event.total - event.loaded),
            etaSeconds: remaining,
          });
        };
      }

      xhr.onload = () => {
        clearTimeout(timeout);
        UploadEmitter.listeners.delete(uploadId);
        if (state !== "uploading") return; // already resolved via socket path

        if (xhr!.status >= 200 && xhr!.status < 300) {
          try {
            const data = JSON.parse(xhr!.responseText);
            const resolvedUrl: string = data.url;
            console.log(`[UPLOAD_SUCCESS] XHR path url=${resolvedUrl}`);
            if (onProgress) {
              onProgress({
                loaded: 100, total: 100, percent: 100,
                loadedStr: "100%", totalStr: "100%", remainingStr: "Done", etaSeconds: 0,
              });
            }
            state = "done";
            settle(() => resolve(resolvedUrl));
          } catch (e) {
            console.error("[UPLOAD_FAILED] Could not parse XHR response JSON", xhr!.responseText);
            state = "failed";
            settle(() => reject(new Error("Upload failed: invalid JSON response")));
          }
        } else {
          let errMsg = `Upload failed: HTTP ${xhr!.status}`;
          try {
            const d = JSON.parse(xhr!.responseText);
            if (d.error) errMsg = `Upload failed: ${d.error}`;
          } catch {}
          console.error(`[UPLOAD_FAILED] XHR path: ${errMsg}`);
          state = "failed";
          settle(() => reject(new Error(errMsg)));
        }
      };

      xhr.onerror = () => {
        clearTimeout(timeout);
        UploadEmitter.listeners.delete(uploadId);
        if (state === "uploading") {
          console.error("[UPLOAD_FAILED] XHR network error");
          state = "failed";
          settle(() => reject(new Error("Upload failed: network error")));
        }
      };

      xhr.ontimeout = () => {
        clearTimeout(timeout);
        UploadEmitter.listeners.delete(uploadId);
        if (state === "uploading") {
          console.error("[UPLOAD_FAILED] XHR request timed out");
          state = "failed";
          settle(() => reject(new Error("Upload failed: request timed out")));
        }
      };

      xhr.onabort = () => {
        clearTimeout(timeout);
        // onabort fires when XHR is aborted by the socket-path winner (state = "done"),
        // or by an explicit cancel (state = "cancelled").
        // Only reject if the promise is not yet settled (cancel case).
        if (!settled && state === "cancelled") {
          settle(() => reject(new Error("Upload cancelled")));
        }
      };

      xhr.send(formData);
    } catch (err: any) {
      console.error(`[UPLOAD_FAILED_SETUP]`, err);
      state = "failed";
      settle(() => reject(err));
    }
  };

  startUpload().catch(() => {});

  return {
    result,
    pause: () => {
      if (state === "uploading") {
        state = "paused";
        xhr?.abort();
        settle(() => reject(new Error("Upload paused")));
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
        xhr?.abort();
        settle(() => reject(new Error("Upload cancelled")));
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
      const fallback =
        asset.fileName ||
        `upload_${i}.${asset.type?.includes("video") ? "mp4" : "jpg"}`;
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
