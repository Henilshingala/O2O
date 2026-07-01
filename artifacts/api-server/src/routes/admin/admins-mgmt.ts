import { Router } from "express";
import { db, users, auditLogs } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { scryptSync, randomBytes } from "crypto";
import { requireAdminAuth, requireSuperAdmin, type AdminRequest } from "../../middlewares/adminAuth";

const router = Router();
router.use(requireAdminAuth);
router.use(requireSuperAdmin);

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

// List all admins
router.get("/", async (req: AdminRequest, res) => {
  try {
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
    }).from(users).where(eq(users.role, "admin"));

    return res.json(admins);
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to list admins" });
  }
});

// Create admin
router.post("/", async (req: AdminRequest, res) => {
  try {
    const { username, fullName, email, mobile, city, password, adminRole } = req.body;

    if (!username || !fullName || !email || !password) {
      return res.status(400).json({ error: "username, fullName, email, and password are required" });
    }

    // Check existing
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Email already taken" });
    }

    const id = `admin_${Date.now()}`;
    const hashedPassword = hashPassword(password);

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

// Disable admin
router.put("/:id/disable", async (req: AdminRequest, res) => {
  try {
    const adminId = req.params.id as string;

    // Prevent self-disable
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

// Enable admin
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

// Reset admin password
router.post("/:id/reset-password", async (req: AdminRequest, res) => {
  try {
    const adminId = req.params.id as string;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const hashed = hashPassword(newPassword);
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

// Change admin role
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
