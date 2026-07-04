import { Linking } from "react-native";

/** Opens maps at coordinates using Android-compatible intents and fallbacks. */
export async function openLocation(lat: number, lng: number, label = "Shared Location") {
  if (Number.isNaN(lat) || Number.isNaN(lng)) return;

  const encodedLabel = encodeURIComponent(label);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  const candidates = [
    `google.navigation:q=${lat},${lng}`,
    `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`,
    googleMapsUrl,
  ];

  for (const url of candidates) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* try next */
    }
  }

  await Linking.openURL(googleMapsUrl);
}
