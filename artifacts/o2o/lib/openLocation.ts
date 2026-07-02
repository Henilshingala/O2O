import { Linking, Platform } from "react-native";

/** Opens maps at coordinates — Google Maps on Android, browser/default on Web. */
export async function openLocation(lat: number, lng: number, label = "Shared Location") {
  if (Number.isNaN(lat) || Number.isNaN(lng)) return;

  const encodedLabel = encodeURIComponent(label);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  if (Platform.OS === "android") {
    // Prefer Google Maps app; fall back to geo: intent, then HTTPS.
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
  }

  if (Platform.OS === "web") {
    window.open(googleMapsUrl, "_blank", "noopener,noreferrer");
    return;
  }

  await Linking.openURL(googleMapsUrl);
}
