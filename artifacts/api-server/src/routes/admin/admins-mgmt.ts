import { Router } from "express";
import { db, users, auditLogs } from "@workspace/db";
import { eq, sql, count } from "drizzle-orm";
import { hashPassword } from "../../lib/crypto";
import { requireAdminAuth, requireSuperAdmin, type AdminRequest } from "../../middlewares/adminAuth";
import { parseOffsetPagination } from "../../lib/pagination";
import { z } from "zod";
import { validateBody } from "../../lib/validation";

const router = Router();
router.use(requireAdminAuth);
router.use(requireSuperAdmin);

const createAdminSchema = z.object({
  username: z.string().min(3),
  fullName: z.string().min(1),
  email: z.string().email(),
  mobile: z.string().optional(),
  city: z.string().optional(),
  password: z.string().min(6),
  adminRole: z.enum(["super_admin", "admin", "moderator", "support"]).optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6),
});

router.get("/", async (req: AdminRequest, res) => {
  try {
    const { page, limit, offset } = parseOffsetPagination(req.query as Record<string, unknown>, { limit: 25, maxLimit: 100 });
    const countResult = await db.select({ count: count() }).from(users).where(eq(users.role, "admin"));
    const total = countResult[0]?.count ?? 0;

    const admins = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      email: users.email,
      mobile: users.mobile,
      city: users.city,
      role: users.role,
      avatar: users.avatar,
      adminRole: users.adminRole,
      isBanned: users.isBanned,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.role, "admin")).orderBy(sql`${users.createdAt} desc`).limit(limit).offset(offset);

    return res.json({ admins, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to list admins" });
  }
});

router.post("/", validateBody(createAdminSchema), async (req: AdminRequest, res) => {
  try {
    const { username, fullName, email, mobile, city, password, adminRole } = req.body;

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email already taken" });
    }

    const id = `admin_${Date.now()}`;
    const hashedPassword = await hashPassword(password);

    await db.insert(users).values({
      id,
      username,
      fullName,
      email,
      mobile: mobile || "0000000000",
      city: city || "System",
      role: "admin",
      password: hashedPassword,
      adminRole: adminRole || "admin",
      isBanned: false,
      isVerifiedSeller: false,
    });

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "admin_create",
      target: `user:${id}`,
      details: { email, adminRole: adminRole || "admin" },
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true, id });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to create admin" });
  }
});

router.put("/:id/disable", async (req: AdminRequest, res) => {
  try {
    const adminId = req.params.id as string;

    if (adminId === req.admin!.userId) {
      return res.status(400).json({ error: "Cannot disable yourself" });
    }

    await db.update(users).set({ isBanned: true, bannedReason: "Disabled by Super Admin" }).where(eq(users.id, adminId));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "admin_disable",
      target: `user:${adminId}`,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to disable admin" });
  }
});

router.put("/:id/enable", async (req: AdminRequest, res) => {
  try {
    const adminId = req.params.id as string;

    await db.update(users).set({ isBanned: false, bannedReason: null, bannedAt: null }).where(eq(users.id, adminId));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "admin_enable",
      target: `user:${adminId}`,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to enable admin" });
  }
});

router.post("/:id/reset-password", validateBody(resetPasswordSchema), async (req: AdminRequest, res) => {
  try {
    const adminId = req.params.id as string;
    const { newPassword } = req.body;

    const hashed = await hashPassword(newPassword);
    await db.update(users).set({ password: hashed }).where(eq(users.id, adminId));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "admin_reset_password",
      target: `user:${adminId}`,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to reset password" });
  }
});

router.put("/:id/role", async (req: AdminRequest, res) => {
  try {
    const adminId = req.params.id as string;
    const { adminRole } = req.body;

    if (!["super_admin", "admin", "moderator", "support"].includes(adminRole)) {
      return res.status(400).json({ error: "Invalid admin role" });
    }

    await db.update(users).set({ adminRole }).where(eq(users.id, adminId));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "admin_role_change",
      target: `user:${adminId}`,
      details: { newRole: adminRole },
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to change role" });
  }
});

export default router;
