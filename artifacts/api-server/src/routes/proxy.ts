/**
 * /api/proxy/download?url=<encoded_cloudinary_url>
 *
 * Server-side proxy that fetches any Cloudinary (or local) file and streams
 * it back to the authenticated mobile client. This bypasses Cloudinary's
 * access_mode restrictions on older uploads that were stored as private.
 */
import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { v2 as cloudinary } from "cloudinary";
import https from "https";
import http from "http";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = Router();
router.use(requireAuth);

/** Derive a signed Cloudinary URL so private resources are accessible */
function makeSignedUrl(rawUrl: string): string {
  try {
    // Extract public_id and resource_type from the URL
    // e.g. https://res.cloudinary.com/{cloud}/image/upload/v.../folder/file.pdf
    const match = rawUrl.match(
      /res\.cloudinary\.com\/[^/]+\/(image|video|raw|auto)\/upload\/(?:v\d+\/)?(.+)/
    );
    if (!match) return rawUrl;

    const resourceType = match[1] === "auto" ? "raw" : match[1];
    // Remove file extension from public_id for Cloudinary
    const publicId = match[2].replace(/\.[^.]+$/, "");
    const ext = match[2].split(".").pop() ?? "";

    const signed = cloudinary.url(publicId, {
      resource_type: resourceType as "image" | "video" | "raw",
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      format: ext,
      type: "upload",
    });
    return signed;
  } catch {
    return rawUrl;
  }
}

router.get("/download", async (req: AuthRequest, res) => {
  const rawUrl = req.query.url as string | undefined;

  if (!rawUrl) {
    return res.status(400).json({ error: "url query parameter is required" });
  }

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(rawUrl);
  } catch {
    return res.status(400).json({ error: "Invalid url encoding" });
  }

  // Only allow Cloudinary or our own server URLs (security guard)
  const isCloudinary = targetUrl.includes("cloudinary.com");
  const isLocal = targetUrl.startsWith("/") || targetUrl.includes("localhost") || targetUrl.includes("onrender.com");
  if (!isCloudinary && !isLocal) {
    return res.status(403).json({ error: "URL not allowed" });
  }

  // Generate a signed URL for Cloudinary resources
  const fetchUrl = isCloudinary ? makeSignedUrl(targetUrl) : targetUrl;

  const protocol = fetchUrl.startsWith("https") ? https : http;

  const proxyReq = protocol.get(fetchUrl, (upstream) => {
    if (upstream.statusCode && upstream.statusCode >= 400) {
      res.status(upstream.statusCode).json({
        error: `Upstream returned ${upstream.statusCode}`,
      });
      upstream.destroy();
      return;
    }

    // Forward content-type and content-length so the mobile client knows the file type
    const contentType = upstream.headers["content-type"] ?? "application/octet-stream";
    const contentLength = upstream.headers["content-length"];
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "attachment");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    upstream.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error("[proxy/download] fetch error:", err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: "Failed to fetch file from upstream" });
    }
  });
});

export default router;
