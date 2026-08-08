import type { Product, ProductImage } from "@/types";

const VIDEO_DETAIL_PREFIX = "__videoUrl";

export function getProductImages(product: Product): ProductImage[] {
  if (product.images?.length) return product.images;
  if (product.image) return [{ id: `${product.id}_primary`, url: product.image, isPrimary: true }];
  return [];
}

export function getProductVideoUrls(product: Product): string[] {
  // Priority 1: use the clean `videos` array from API response
  if (product.videos && product.videos.length > 0) {
    return product.videos.filter(Boolean);
  }
  // Priority 2: read from videoUrl + __videoUrl_ detail entries (legacy/stored format)
  const urls: string[] = [];
  if (product.videoUrl) urls.push(product.videoUrl);
  const hidden = product.details?.filter((d) => d.name.startsWith(VIDEO_DETAIL_PREFIX));
  if (hidden) {
    hidden.forEach(h => {
      if (!urls.includes(h.value)) urls.push(h.value);
    });
  }
  return urls;
}

export function getProductVideoUrl(product: Product): string | undefined {
  return getProductVideoUrls(product)[0];
}

export function getProductPrimaryImage(product: Product): string | undefined {
  const images = getProductImages(product);
  const primary = images.find((i) => i.isPrimary) ?? images[0];
  return primary?.url ?? product.image;
}

/** Strip internal media keys from details shown in UI. */
export function getDisplayDetails(product: Product) {
  return (product.details ?? []).filter((d) => !d.name.startsWith(VIDEO_DETAIL_PREFIX));
}
