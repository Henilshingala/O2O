import { Platform } from "react-native";
import { customFetch } from "@workspace/api-client-react";

export interface UploadAsset {
  uri?: string | null;
  type?: string | null;
  fileName?: string | null;
}

function normalizeUri(uri: string) {
  if (Platform.OS === "android" && uri && !uri.startsWith("file://") && !uri.startsWith("http")) {
    return `file://${uri}`;
  }
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
