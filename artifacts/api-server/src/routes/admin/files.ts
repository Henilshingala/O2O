import { Router } from "express";
import { db, fileUploads, auditLogs } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import path from "path";
import fs from "fs";
import { requireAdminAuth, requirePermission, type AdminRequest } from "../../middlewares/adminAuth";

const router = Router();
router.use(requireAdminAuth);

// List files
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

    // Calculate total storage
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

// Delete file
router.delete("/:id", requirePermission("files.delete"), async (req: AdminRequest, res) => {
  try {
    const fileId = req.params.id as string;

    const file = await db.select().from(fileUploads).where(eq(fileUploads.id, fileId)).limit(1);
    if (file.length === 0) return res.status(404).json({ error: "File not found" });

    // Try to delete from filesystem
    const filePath = path.join(process.cwd(), file[0].url);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch { /* file may not exist on disk */ }

    await db.delete(fileUploads).where(eq(fileUploads.id, fileId));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "file_delete",
      target: `file:${fileId}`,
      details: { url: file[0].url },
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

// Storage stats
router.get("/stats", requirePermission("files.view"), async (req: AdminRequest, res) => {
  try {
    const typeStats = await db.execute(sql`
      SELECT type, count(*)::integer as count, coalesce(sum(size), 0)::integer as total_size
      FROM file_uploads
      GROUP BY type
    `);

    const uploadDir = path.join(process.cwd(), "uploads");
    let diskFiles = 0;
    try {
      if (fs.existsSync(uploadDir)) {
        diskFiles = fs.readdirSync(uploadDir).length;
      }
    } catch { /* ok */ }

    return res.json({
      typeStats: typeStats.rows,
      diskFiles,
    });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to get file stats" });
  }
});

export default router;
