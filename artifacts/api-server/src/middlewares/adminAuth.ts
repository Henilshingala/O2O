import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { db, adminSessions } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production");
    }
    return "dev_fallback_secret_change_in_prod";
  }
  return secret;
}

export interface AdminUser {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  adminRole: string;
}

export interface AdminRequest extends Request {
  admin?: AdminUser;
}

const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  admin: 75,
  moderator: 50,
  support: 25,
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["*"],
  admin: [
    "dashboard.view", "users.view", "users.edit", "users.ban", "users.delete",
    "channels.view", "channels.edit", "channels.delete",
    "products.view", "products.edit", "products.delete",
    "orders.view", "orders.edit",
    "bids.view", "bids.edit",
    "chats.view", "chats.moderate",
    "reviews.view", "reviews.edit", "reviews.delete",
    "notifications.view", "notifications.send",
    "files.view", "files.delete",
    "audit.view",
    "db.view", "db.edit", "db.create", "db.delete",
    "analytics.view",
    "settings.view",
  ],
  moderator: [
    "dashboard.view", "users.view",
    "channels.view",
    "products.view",
    "orders.view",
    "bids.view",
    "chats.view", "chats.moderate",
    "reviews.view", "reviews.edit", "reviews.delete",
    "notifications.view",
    "files.view",
    "audit.view",
    "db.view",
    "analytics.view",
  ],
  support: [
    "dashboard.view", "users.view",
    "channels.view",
    "products.view",
    "orders.view",
    "bids.view",
    "chats.view",
    "reviews.view",
    "notifications.view",
    "analytics.view",
  ],
};

export function hasPermission(adminRole: string, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[adminRole];
  if (!perms) return false;
  if (perms.includes("*")) return true;
  return perms.includes(permission);
}

export async function requireAdminAuth(req: AdminRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as AdminUser;
    if (!payload.adminRole) {
      return res.status(403).json({ error: "Not an admin user" });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const sessions = await db
      .select()
      .from(adminSessions)
      .where(
        and(
          eq(adminSessions.adminId, payload.userId),
          eq(adminSessions.tokenHash, tokenHash),
          eq(adminSessions.isActive, true)
        )
      )
      .limit(1);

    const session = sessions[0];
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: "Session expired or invalidated" });
    }

    req.admin = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requirePermission(permission: string) {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!hasPermission(req.admin.adminRole, permission)) {
      return res.status(403).json({ error: `Insufficient permissions. Required: ${permission}` });
    }
    return next();
  };
}

export function requireSuperAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  if (!req.admin) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (req.admin.adminRole !== "super_admin") {
    return res.status(403).json({ error: "Super Admin access required" });
  }
  return next();
}

export { ROLE_PERMISSIONS, ROLE_HIERARCHY };
