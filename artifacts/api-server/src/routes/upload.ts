import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { fileUploads } from "@workspace/db/schema";
import { v2 as cloudinary } from "cloudinary";
import { emitToUser } from "../socket/index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const localUploadsDir = path.resolve(currentDir, "..", "..", "uploads");

if (!fs.existsSync(localUploadsDir)) {
  fs.mkdirSync(localUploadsDir, { recursive: true });
}

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // allow up to 200 uploads per 15min window (for album uploads)
  message: { error: "Too many uploads. Try again later." },
});

const router = Router();
router.use(requireAuth);
router.use(uploadLimiter);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_IMAGE_SIZE = 15 * 1024 * 1024;   // 15 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;  // 100 MB
const MAX_DOC_SIZE   = 50 * 1024 * 1024;   // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/aac",
  "audio/m4a",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/octet-stream", // generic fallback used by many Android pickers
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif",
  ".mp4", ".mov", ".webm", ".3gp",
  ".mp3", ".m4a", ".ogg", ".wav", ".aac",
  ".pdf", ".doc", ".docx", ".txt",
  ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip",
]);

const uploadDir = path.join(os.tmpdir(), "o2o-uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    cb(null, `upload_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Accept if extension is known OR if mime is application/octet-stream (generic document)
    const extOk = ALLOWED_EXTENSIONS.has(ext) || ext === "";
    const mimeOk = ALLOWED_MIME_TYPES.has(file.mimetype);
    if (!extOk && !mimeOk) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

function uploadToCloudinary(
  filePath: string,
  options: { resource_type: "image" | "video" | "auto"; folder: string },
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: options.resource_type, folder: options.folder },
      (error, result) => {
        if (error || !result) reject(error ?? new Error("Upload failed"));
        else resolve({ secure_url: result.secure_url, public_id: result.public_id });
      },
    );
    fs.createReadStream(filePath).pipe(stream);
  });
}

function cleanupTempFile(filePath: string) {
  fs.unlink(filePath, () => {});
}

function getCloudinaryResourceType(mime: string): "image" | "video" | "auto" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "video"; // Cloudinary stores audio under "video"
  return "auto"; // for documents, uses "raw" but "auto" works too
}

router.post("/", upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = req.file.path;
  const mime = req.file.mimetype;
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");
  const isImage = mime.startsWith("image/");

  // Size check per category
  const maxSize = isVideo ? MAX_VIDEO_SIZE : isAudio ? MAX_DOC_SIZE : isImage ? MAX_IMAGE_SIZE : MAX_DOC_SIZE;

  if (req.file.size > maxSize) {
    cleanupTempFile(filePath);
    return res.status(400).json({
      error: `File too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB`,
    });
  }

  try {
    const hasCloudinary = !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
    console.log(`[upload] hasCloudinary=${hasCloudinary}, mime=${mime}, size=${req.file.size}`);

    let url: string;
    if (hasCloudinary) {
      const resourceType = getCloudinaryResourceType(mime);
      const result = await uploadToCloudinary(filePath, {
        resource_type: resourceType,
        folder: "o2o_uploads",
      });
      cleanupTempFile(filePath);
      url = result.secure_url;
    } else {
      // Fallback to local file storage
      const filename = path.basename(filePath);
      const destPath = path.join(localUploadsDir, filename);
      fs.copyFileSync(filePath, destPath);
      cleanupTempFile(filePath);
      url = `/uploads/${filename}`;
    }

    console.log(`[upload] success url=${url}`);
    const fileId = `file_${Date.now()}`;

    await db.insert(fileUploads).values({
      id: fileId,
      url,
      uploaderId: req.user!.userId,
      size: req.file.size,
      type: mime,
    });

    if (req.body.uploadId) {
      console.log(`[upload] Emitting upload:complete to user ${req.user!.userId} for uploadId ${req.body.uploadId}`);
      emitToUser(req.user!.userId, "upload:complete", {
        uploadId: req.body.uploadId,
        url,
        id: fileId,
        mimeType: mime,
        fileName: req.file.originalname,
      });
    }

    return res.json({ url, id: fileId, mimeType: mime, fileName: req.file.originalname });
  } catch (error: any) {
    cleanupTempFile(filePath);
    console.error("[upload] error:", error?.message, error?.stack);
    req.log?.error(error);
    return res.status(500).json({ error: "Upload failed", detail: error?.message });
  }
});

router.use((err: Error, _req: AuthRequest, res: import("express").Response, next: import("express").NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large" });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message?.startsWith("Unsupported file type") || err.message === "Invalid file extension" || err.message === "Invalid file type") {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

export default router;

