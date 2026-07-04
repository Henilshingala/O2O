import { Router } from "express";
import { db, users, auditLogs, adminSessions } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { requireAdminAuth, type AdminRequest, getJwtSecret } from "../../middlewares/adminAuth";
import { hashPassword, verifyPassword } from "../../lib/crypto";
import { z } from "zod";
import { validateBody } from "../../lib/validation";

const router = Router();

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

router.post("/login", validateBody(adminLoginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = result[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: "Account is banned" });
    }

    if (!(await verifyPassword(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      adminRole: user.adminRole || "admin",
    };

    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: "24h" });

    const sessionId = `sess_${Date.now()}`;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(adminSessions).values({
      id: sessionId,
      adminId: user.id,
      tokenHash,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      createdAt: new Date(),
      expiresAt,
      isActive: true,
    });

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: user.id,
      action: "admin_login",
      target: `user:${user.id}`,
      details: { email: user.email },
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    const { password: _, ...userWithoutPassword } = user;
    return res.json({ token, user: { ...userWithoutPassword, adminRole: user.adminRole || "admin" } });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", requireAdminAuth, async (req: AdminRequest, res) => {
  try {
    const adminId = req.admin!.userId;
    const result = await db.select().from(users).where(eq(users.id, adminId)).limit(1);
    const user = result[0];
    if (!user) return res.status(404).json({ error: "Admin not found" });

    const { password: _, ...userWithoutPassword } = user;
    return res.json(userWithoutPassword);
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", requireAdminAuth, async (req: AdminRequest, res) => {
  try {
    const adminId = req.admin!.userId;
    await db.update(adminSessions)
      .set({ isActive: false })
      .where(eq(adminSessions.adminId, adminId));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId,
      action: "admin_logout",
      target: `user:${adminId}`,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/change-password", requireAdminAuth, validateBody(changePasswordSchema), async (req: AdminRequest, res) => {
  try {
    const adminId = req.admin!.userId;
    const { currentPassword, newPassword } = req.body;

    const result = await db.select().from(users).where(eq(users.id, adminId)).limit(1);
    const user = result[0];
    if (!user) return res.status(404).json({ error: "Admin not found" });

    if (!(await verifyPassword(currentPassword, user.password))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashed = await hashPassword(newPassword);
    await db.update(users).set({ password: hashed }).where(eq(users.id, adminId));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId,
      action: "admin_password_change",
      target: `user:${adminId}`,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invalidate-sessions", requireAdminAuth, async (req: AdminRequest, res) => {
  try {
    const adminId = req.admin!.userId;
    if (req.admin!.adminRole !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can invalidate all sessions" });
    }

    await db.update(adminSessions)
      .set({ isActive: false })
      .where(ne(adminSessions.adminId, adminId));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId,
      action: "invalidate_all_sessions",
      target: "all_admin_sessions",
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
