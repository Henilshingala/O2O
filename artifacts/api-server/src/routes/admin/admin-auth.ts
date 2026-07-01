import { Router } from "express";
import { db, users, auditLogs, adminSessions } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { scryptSync, randomBytes, timingSafeEqual, createHash } from "crypto";
import { requireAdminAuth, type AdminRequest, JWT_SECRET } from "../../middlewares/adminAuth";

const router = Router();

function verifyPassword(password: string, hash: string): boolean {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = scryptSync(password, salt, 64);
  return timingSafeEqual(keyBuffer, derivedKey);
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

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

    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      adminRole: user.adminRole || "admin",
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "24h" });

    // Log the session
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

    // Log audit
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
    // Deactivate all sessions for this admin
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

router.post("/change-password", requireAdminAuth, async (req: AdminRequest, res) => {
  try {
    const adminId = req.admin!.userId;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    const result = await db.select().from(users).where(eq(users.id, adminId)).limit(1);
    const user = result[0];
    if (!user) return res.status(404).json({ error: "Admin not found" });

    if (!verifyPassword(currentPassword, user.password)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashed = hashPassword(newPassword);
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
    // Only super_admin can invalidate all sessions
    if (req.admin!.adminRole !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can invalidate all sessions" });
    }

    // Deactivate all sessions except the current admin's
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
