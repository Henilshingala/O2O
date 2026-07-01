import { Router } from "express";
import { db } from "@workspace/db";
import { notifications } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

const genId = (prefix: string) => `${prefix}_${Date.now()}`;

export async function createNotification(
  userId: string,
  title: string,
  body: string,
  type: string,
  io?: { to: (room: string) => { emit: (event: string, data: unknown) => void } } | null
) {
  const id = genId("notif");
  const row = { id, userId, title, body, type, isRead: false };
  await db.insert(notifications).values(row);
  if (io) {
    io.to(`user:${userId}`).emit("notification:new", row);
  }
  return row;
}

router.get("/", async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.user!.userId))
      .orderBy(desc(notifications.createdAt));
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/read", async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, req.params.id as string), eq(notifications.userId, req.user!.userId)));
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/read-all", async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, req.user!.userId));
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
