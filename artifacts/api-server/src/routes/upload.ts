import { Router } from "express";
import multer from "multer";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { fileUploads } from "@workspace/db/schema";
import path from "path";
import fs from "fs";

const router = Router();
router.use(requireAuth);

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || ".png";
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/", upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const url = `/uploads/${req.file.filename}`;
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
});

export default router;
