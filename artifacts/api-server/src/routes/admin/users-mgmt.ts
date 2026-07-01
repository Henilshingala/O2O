import { Router } from "express";
import { db, users, loginHistory, userActivityLogs, sellerAccounts, auditLogs } from "@workspace/db";
import { eq, sql, or, ilike } from "drizzle-orm";
import { scryptSync, randomBytes } from "crypto";
import { requireAdminAuth, requirePermission, type AdminRequest } from "../../middlewares/adminAuth";

const router = Router();
router.use(requireAdminAuth);

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

// List users with pagination and search
router.get("/", requirePermission("users.view"), async (req: AdminRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || "";
    const roleFilter = (req.query.role as string) || "";
    const bannedFilter = req.query.banned as string;

    let conditions: any[] = [];
    if (search) {
      conditions.push(sql`(${users.username} ILIKE ${`%${search}%`} OR ${users.fullName} ILIKE ${`%${search}%`} OR ${users.email} ILIKE ${`%${search}%`})`);
    }
    if (roleFilter) {
      conditions.push(sql`${users.role} = ${roleFilter}`);
    }
    if (bannedFilter === "true") {
      conditions.push(sql`${users.isBanned} = true`);
    } else if (bannedFilter === "false") {
      conditions.push(sql`${users.isBanned} = false`);
    }

    const whereClause = conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1=1`;

    const countResult = await db.execute(sql`SELECT count(*)::integer as count FROM users WHERE ${whereClause}`);
    const total = (countResult.rows[0] as any)?.count ?? 0;

    const result = await db.execute(sql`
      SELECT id, username, full_name, email, mobile, city, role, avatar, is_banned, banned_at, banned_reason, is_verified_seller, admin_role, created_at
      FROM users WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return res.json({
      users: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to list users" });
  }
});

// Get user detail
router.get("/:id", requirePermission("users.view"), async (req: AdminRequest, res) => {
  try {
    const userId = req.params.id as string;
    const result = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      email: users.email,
      mobile: users.mobile,
      city: users.city,
      role: users.role,
      avatar: users.avatar,
      isBanned: users.isBanned,
      bannedAt: users.bannedAt,
      bannedReason: users.bannedReason,
      isVerifiedSeller: users.isVerifiedSeller,
      adminRole: users.adminRole,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId)).limit(1);

    const user = result[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    // Get login history
    const logins = await db.select().from(loginHistory)
      .where(eq(loginHistory.userId, userId))
      .orderBy(sql`${loginHistory.timestamp} desc`)
      .limit(50);

    // Get activity logs
    const activity = await db.select().from(userActivityLogs)
      .where(eq(userActivityLogs.userId, userId))
      .orderBy(sql`${userActivityLogs.timestamp} desc`)
      .limit(50);

    return res.json({ user, loginHistory: logins, activityLogs: activity });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to get user" });
  }
});

// Edit user
router.put("/:id", requirePermission("users.edit"), async (req: AdminRequest, res) => {
  try {
    const userId = req.params.id as string;
    const { fullName, email, mobile, city, role } = req.body;

    await db.update(users).set({
      ...(fullName !== undefined && { fullName }),
      ...(email !== undefined && { email }),
      ...(mobile !== undefined && { mobile }),
      ...(city !== undefined && { city }),
      ...(role !== undefined && { role }),
    }).where(eq(users.id, userId));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "user_edit",
      target: `user:${userId}`,
      details: req.body,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to update user" });
  }
});

// Ban user
router.post("/:id/ban", requirePermission("users.ban"), async (req: AdminRequest, res) => {
  try {
    const userId = req.params.id as string;
    const { reason } = req.body;

    await db.update(users).set({
      isBanned: true,
      bannedAt: new Date(),
      bannedReason: reason || "No reason specified",
    }).where(eq(users.id, userId));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "user_ban",
      target: `user:${userId}`,
      details: { reason },
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to ban user" });
  }
});

// Unban user
router.post("/:id/unban", requirePermission("users.ban"), async (req: AdminRequest, res) => {
  try {
    const userId = req.params.id as string;

    await db.update(users).set({
      isBanned: false,
      bannedAt: null,
      bannedReason: null,
    }).where(eq(users.id, userId));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "user_unban",
      target: `user:${userId}`,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to unban user" });
  }
});

// Delete user
router.delete("/:id", requirePermission("users.delete"), async (req: AdminRequest, res) => {
  try {
    const userId = req.params.id as string;

    await db.delete(users).where(eq(users.id, userId));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "user_delete",
      target: `user:${userId}`,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to delete user" });
  }
});

// Verify seller
router.post("/:id/verify-seller", requirePermission("users.edit"), async (req: AdminRequest, res) => {
  try {
    const userId = req.params.id as string;

    await db.update(users).set({ isVerifiedSeller: true }).where(eq(users.id, userId));

    // Also update seller_accounts if exists
    try {
      await db.update(sellerAccounts).set({ verificationStatus: "verified" }).where(eq(sellerAccounts.userId, userId));
    } catch { /* may not exist */ }

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "seller_verify",
      target: `user:${userId}`,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to verify seller" });
  }
});

// Reset password
router.post("/:id/reset-password", requirePermission("users.edit"), async (req: AdminRequest, res) => {
  try {
    const userId = req.params.id as string;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const hashed = hashPassword(newPassword);
    await db.update(users).set({ password: hashed }).where(eq(users.id, userId));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "password_reset",
      target: `user:${userId}`,
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

export default router;
