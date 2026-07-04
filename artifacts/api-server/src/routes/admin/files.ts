import { Router } from "express";
import { db, fileUploads, auditLogs } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { requireAdminAuth, requirePermission, type AdminRequest } from "../../middlewares/adminAuth";

const router = Router();
router.use(requireAdminAuth);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function extractCloudinaryPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
  return match?.[1] ?? null;
}

router.get("/", requirePermission("files.view"), async (req: AdminRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const offset = (page - 1) * limit;

    const countResult = await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(fileUploads);
    const total = countResult[0]?.count ?? 0;

    const files = await db.select().from(fileUploads)
      .orderBy(sql`${fileUploads.timestamp} desc`)
      .limit(limit)
      .offset(offset);

    const storageResult = await db.select({ total: sql<number>`coalesce(cast(sum(${fileUploads.size}) as integer), 0)` }).from(fileUploads);

    return res.json({
      files,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalStorage: storageResult[0]?.total ?? 0,
    });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to list files" });
  }
});

router.delete("/:id", requirePermission("files.delete"), async (req: AdminRequest, res) => {
  try {
    const fileId = req.params.id as string;

    const file = await db.select().from(fileUploads).where(eq(fileUploads.id, fileId)).limit(1);
    if (file.length === 0) return res.status(404).json({ error: "File not found" });

    const url = file[0]!.url;
    if (url.includes("cloudinary.com")) {
      const publicId = extractCloudinaryPublicId(url);
      if (publicId) {
        try {
          const resourceType = file[0]!.type.startsWith("video/") ? "video" : "image";
          await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        } catch (e) {
          req.log.warn({ err: e, publicId }, "Cloudinary delete failed");
        }
      }
    }

    await db.delete(fileUploads).where(eq(fileUploads.id, fileId));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "file_delete",
      target: `file:${fileId}`,
      details: { url },
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to delete file" });
  }
});

router.get("/stats", requirePermission("files.view"), async (req: AdminRequest, res) => {
  try {
    const typeStats = await db.execute(sql`
      SELECT type, count(*)::integer as count, coalesce(sum(size), 0)::integer as total_size
      FROM file_uploads
      GROUP BY type
    `);

    return res.json({
      typeStats: typeStats.rows,
    });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to get file stats" });
  }
});

export default router;
