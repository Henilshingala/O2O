import { API_URL } from "@env";

const API_BASE_URL = API_URL || (__DEV__ ? "http://127.0.0.1:5000" : "http://192.168.0.101:5000");

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://") || url.startsWith("data:")) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}
