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

export function getVideoThumbnailUrl(url?: string | null): string | undefined {
  const resolved = resolveMediaUrl(url);
  if (!resolved) return undefined;
  // If it's a Cloudinary URL (or similar service) ending in a video extension, request the JPG thumbnail
  if (resolved.match(/\.(mp4|mov|webm)$/i)) {
    return resolved.replace(/\.(mp4|mov|webm)$/i, ".jpg");
  }
  return resolved;
}
