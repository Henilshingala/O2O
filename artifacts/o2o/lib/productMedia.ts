import type { Product, ProductImage } from "@/types";

const VIDEO_DETAIL_KEY = "__videoUrl";

export function getProductImages(product: Product): ProductImage[] {
  if (product.images?.length) return product.images;
  if (product.image) return [{ id: `${product.id}_primary`, url: product.image, isPrimary: true }];
  return [];
}

export function getProductVideoUrl(product: Product): string | undefined {
  if (product.videoUrl) return product.videoUrl;
  const hidden = product.details?.find((d) => d.name === VIDEO_DETAIL_KEY);
  return hidden?.value;
}

export function getProductPrimaryImage(product: Product): string | undefined {
  const images = getProductImages(product);
  const primary = images.find((i) => i.isPrimary) ?? images[0];
  return primary?.url ?? product.image;
}

/** Strip internal media keys from details shown in UI. */
export function getDisplayDetails(product: Product) {
  return (product.details ?? []).filter((d) => d.name !== VIDEO_DETAIL_KEY);
}
