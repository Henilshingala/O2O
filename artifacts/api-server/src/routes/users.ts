import { Router } from "express";
import { db, users } from "@workspace/db";
import { userSettings } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

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
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/me/settings", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const existing = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
    const filtered: Record<string, unknown> = {};
    if (req.body.theme !== undefined) filtered.theme = req.body.theme;
    if (req.body.notificationsEnabled !== undefined) filtered.notificationsEnabled = req.body.notificationsEnabled;
    if (req.body.privacyLevel !== undefined) filtered.privacyLevel = req.body.privacyLevel;
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
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const result = await db.select().from(users).where(eq(users.id, req.params.id as string)).limit(1);
    const user = result[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    const { password: _, ...profile } = user;
    return res.json(profile);
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
