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
 * Upload a single file using XMLHttpRequest so that:
 * 1. React Native's native multipart/form-data support is used (works on 0.68 Old Arch)
 * 2. Progress events are available for real-time UI
 * 3. The XHR can be aborted for cancel/pause/resume
 */
export function uploadFileWithProgress(
  asset: UploadAsset,
  fallbackName = "upload",
  onProgress?: (p: UploadProgress) => void,
  signal?: AbortSignal
): UploadHandle {
  let state: UploadState = "idle";
  let xhr: XMLHttpRequest | null = null;
  let resolve!: (url: string) => void;
  let reject!: (err: Error) => void;

  const result = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const startUpload = async () => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const base = getBaseUrl();

    const formData = new FormData();
    formData.append("file", {
      uri: normalizeUri(asset.uri!),
      type: asset.type || "application/octet-stream",
      name: asset.fileName || fallbackName,
    } as any);

    xhr = new XMLHttpRequest();
    const url = `${base}/api/upload`;
    xhr.open("POST", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    const startTime = Date.now();

    if (xhr.upload && onProgress) {
      xhr.upload.addEventListener("progress", (e: ProgressEvent) => {
        if (!e.lengthComputable) return;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = e.loaded / elapsed; // bytes per second
        const remaining = e.total - e.loaded;
        const eta = speed > 0 ? remaining / speed : NaN;
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
          loadedStr: formatBytes(e.loaded),
          totalStr: formatBytes(e.total),
          remainingStr: formatBytes(remaining),
          etaSeconds: eta,
        });
      });
    }

    // Some React Native / Android XHR polyfills fail to fire `onload` reliably
    // for multipart/form-data uploads (progress reaches 100% but the request
    // never "completes" from JS's perspective), leaving the caller's promise
    // pending forever even though the server already received and processed
    // the upload. Settle from a single place so both `onload` and the
    // `readystatechange`/`loadend` fallbacks can safely call it exactly once.
    let settled = false;
    const settleFromResponse = () => {
      if (settled || state === "cancelled") return;
      settled = true;
      if (xhr!.status >= 200 && xhr!.status < 300) {
        try {
          const data = JSON.parse(xhr!.responseText);
          state = "done";
          resolve(data.url);
        } catch {
          state = "failed";
          reject(new Error(`Upload failed: could not parse server response`));
        }
      } else {
        state = "failed";
        let errMsg = `Upload failed: HTTP ${xhr!.status}`;
        try {
          const d = JSON.parse(xhr!.responseText);
          if (d.error) errMsg = `Upload failed: ${d.error}`;
        } catch {/* ignore */}
        reject(new Error(errMsg));
      }
    };

    xhr.onload = settleFromResponse;

    // Fallback: if `onload` never fires but the request did complete
    // (readyState 4 with a status), settle anyway instead of leaving the
    // upload placeholder stuck indefinitely.
    xhr.onreadystatechange = () => {
      if (xhr!.readyState === 4 && xhr!.status !== 0) {
        settleFromResponse();
      }
    };

    xhr.onerror = () => {
      if (state === "cancelled" || settled) return;
      settled = true;
      state = "failed";
      reject(new Error("Upload failed: network error"));
    };

    xhr.ontimeout = () => {
      if (settled) return;
      settled = true;
      state = "failed";
      reject(new Error("Upload failed: request timed out"));
    };

    xhr.timeout = 300_000; // 5 min max
    state = "uploading";

    if (signal?.aborted) {
      state = "cancelled";
      reject(new Error("Upload cancelled"));
      return;
    }

    signal?.addEventListener("abort", () => {
      state = "cancelled";
      xhr?.abort();
      reject(new Error("Upload cancelled"));
    });

    xhr.send(formData);
  };

  startUpload().catch((err) => {
    state = "failed";
    reject(err instanceof Error ? err : new Error(String(err)));
  });

  return {
    result,
    pause: () => {
      // XHR doesn't support true pause; we abort and mark as paused
      if (state === "uploading") {
        state = "paused";
        xhr?.abort();
        reject(new Error("Upload paused"));
      }
    },
    resume: () => {
      // Restart upload (no byte-range resume in simple XHR)
      if (state === "paused") {
        const newHandle = uploadFileWithProgress(asset, fallbackName, onProgress, signal);
        newHandle.result.then(resolve).catch(reject);
      }
    },
    cancel: () => {
      if (state === "uploading" || state === "paused" || state === "idle") {
        state = "cancelled";
        xhr?.abort();
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
