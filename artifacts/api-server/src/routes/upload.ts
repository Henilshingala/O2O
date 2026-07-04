import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { fileUploads } from "@workspace/db/schema";
import { v2 as cloudinary } from "cloudinary";

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
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

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".mp4",
  ".mov",
  ".webm",
]);

const uploadDir = path.join(os.tmpdir(), "o2o-uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `upload_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error("Invalid file extension"));
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Invalid file type"));
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

router.post("/", upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = req.file.path;
  const isVideo = req.file.mimetype.startsWith("video/");
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

  if (req.file.size > maxSize) {
    cleanupTempFile(filePath);
    return res.status(400).json({
      error: `File too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB`,
    });
  }

  try {
    const result = await uploadToCloudinary(filePath, {
      resource_type: isVideo ? "video" : "auto",
      folder: "o2o_uploads",
    });

    cleanupTempFile(filePath);

    const url = result.secure_url;
    const fileId = `file_${Date.now()}`;

    await db.insert(fileUploads).values({
      id: fileId,
      url,
      uploaderId: req.user!.userId,
      size: req.file.size,
      type: req.file.mimetype,
    });

    return res.json({ url, id: fileId });
  } catch (error) {
    cleanupTempFile(filePath);
    req.log.error(error);
    return res.status(500).json({ error: "Upload failed" });
  }
});

router.use((err: Error, _req: AuthRequest, res: import("express").Response, next: import("express").NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large" });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message === "Invalid file extension" || err.message === "Invalid file type") {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

export default router;
