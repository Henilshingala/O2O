import { getBaseUrl } from "@workspace/api-client-react";

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("file://") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  const base = getBaseUrl();
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}
