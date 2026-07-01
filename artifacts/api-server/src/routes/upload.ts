import { Router } from "express";
import multer from "multer";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { fileUploads } from "@workspace/db/schema";
import { v2 as cloudinary } from "cloudinary";

const router = Router();
router.use(requireAuth);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/", upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  
  try {
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    
    const isVideo = req.file.mimetype.startsWith("video/");
    const result = await cloudinary.uploader.upload(dataURI, {
      resource_type: isVideo ? "video" : "auto",
      folder: "o2o_uploads"
    });
    
    const url = result.secure_url;
    const fileId = `file_${Date.now()}`;
    
    try {
      await db.insert(fileUploads).values({
        id: fileId,
        url,
        uploaderId: req.user!.userId,
        size: req.file.size,
        type: req.file.mimetype || "application/octet-stream",
      });
    } catch (e) {
      // non-fatal if file_uploads insert fails
    }
    
    return res.json({ url, id: fileId });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
