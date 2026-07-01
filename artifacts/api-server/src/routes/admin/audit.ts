import { Router } from "express";
import { db, auditLogs } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdminAuth, requirePermission, type AdminRequest } from "../../middlewares/adminAuth";

const router = Router();
router.use(requireAdminAuth);
router.use(requirePermission("audit.view"));

router.get("/", async (req: AdminRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;
    const actionFilter = (req.query.action as string) || "";
    const adminFilter = (req.query.adminId as string) || "";

    let conditions: any[] = [];
    if (actionFilter) {
      conditions.push(sql`${auditLogs.action} = ${actionFilter}`);
    }
    if (adminFilter) {
      conditions.push(sql`${auditLogs.adminId} = ${adminFilter}`);
    }

    const whereClause = conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1=1`;

    const countResult = await db.execute(sql`SELECT count(*)::integer as count FROM audit_logs WHERE ${whereClause}`);
    const total = (countResult.rows[0] as any)?.count ?? 0;

    const result = await db.execute(sql`
      SELECT al.*, u.username as admin_username, u.full_name as admin_name
      FROM audit_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      WHERE ${whereClause}
      ORDER BY al.timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return res.json({
      logs: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to load audit logs" });
  }
});

// Get unique action types for filter dropdown
router.get("/actions", async (req: AdminRequest, res) => {
  try {
    const result = await db.execute(sql`SELECT DISTINCT action FROM audit_logs ORDER BY action`);
    return res.json(result.rows.map((r: any) => r.action));
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to load action types" });
  }
});

// Clear all audit logs (super admin only)
router.delete("/clear", requirePermission("audit.clear"), async (req: AdminRequest, res) => {
  try {
    if (req.admin!.adminRole !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can clear audit logs" });
    }

    await db.delete(auditLogs);

    // Log the clear action itself
    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "audit_logs_cleared",
      target: "audit_logs",
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to clear audit logs" });
  }
});

export default router;
