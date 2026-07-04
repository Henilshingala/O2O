import { customFetch } from "@workspace/api-client-react";

export interface UploadAsset {
  uri?: string | null;
  type?: string | null;
  fileName?: string | null;
}

function normalizeUri(uri: string) {
  // Already has a scheme (content://, file://, http://, etc.)
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(uri)) {
    return uri;
  }

  // Absolute path without scheme - prepend file://
  if (uri.startsWith("/")) {
    return `file://${uri}`;
  }

  // Relative path - assume it's already correct or return as-is
  return uri;
}

export async function uploadFile(asset: UploadAsset, fallbackName = "upload.jpg"): Promise<string> {
  if (!asset.uri) throw new Error("Missing file URI");
  const formData = new FormData();
  formData.append("file", {
    uri: normalizeUri(asset.uri),
    type: asset.type || "application/octet-stream",
    name: asset.fileName || fallbackName,
  } as any);

  const data = await customFetch<{ url: string }>("/api/upload", {
    method: "POST",
    body: formData,
    timeoutMs: 120000,
  });
  return data.url;
}

export async function uploadFiles(assets: UploadAsset[]): Promise<string[]> {
  return Promise.all(
    assets.map((a, i) =>
      uploadFile(a, a.fileName || `upload_${i}.${a.type?.includes("video") ? "mp4" : "jpg"}`)
    )
  );
}
