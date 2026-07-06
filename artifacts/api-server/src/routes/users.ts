import { Router } from "express";
import { db, users } from "@workspace/db";
import { userSettings } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();
router.use(requireAuth);

const settingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).optional(),
  notificationsEnabled: z.boolean().optional(),
  privacyLevel: z.enum(["public", "friends", "private"]).optional(),
});

router.get("/me/settings", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
    if (!rows[0]) {
      const defaults = { userId, theme: "system" as const, notificationsEnabled: true, privacyLevel: "public" as const };
      await db.insert(userSettings).values(defaults);
      return res.json(defaults);
    }
    return res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "GET /me/settings failed");
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/me/settings", async (req: AuthRequest, res) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid settings" });
    }
    const userId = req.user!.userId;
    const filtered = parsed.data;

    const existing = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
    if (existing.length === 0) {
      await db.insert(userSettings).values({
        userId,
        theme: "system",
        notificationsEnabled: true,
        privacyLevel: "public",
        ...filtered,
      });
    } else if (Object.keys(filtered).length > 0) {
      await db.update(userSettings).set(filtered).where(eq(userSettings.userId, userId));
    }
    const updated = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
    return res.json(updated[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /me/settings failed");
    return res.status(500).json({ error: "Server error" });
  }
});

// Public profile — only expose non-sensitive fields
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const result = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        avatar: users.avatar,
        city: users.city,
        country: users.country,
        role: users.role,
        isVerifiedSeller: users.isVerifiedSeller,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.params.id as string))
      .limit(1);
    const user = result[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (err) {
    logger.error({ err }, "GET /users/:id failed");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
