import { Router } from "express";
import { db } from "@workspace/db";
import { notifications } from "@workspace/db/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { parseCursorPagination, sendListResponse, buildOffsetMeta, parseOffsetPagination } from "../lib/pagination";

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
    const userId = req.user!.userId;
    const cursorMode = typeof req.query.cursor === "string" && req.query.cursor.length > 0;

    if (cursorMode || req.query.cursor === "") {
      const { limit, cursor } = parseCursorPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });
      let query = db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit + 1);

      const rows = await query;
      let filtered = rows;
      if (cursor) {
        const cursorIdx = rows.findIndex((r) => r.id === cursor);
        filtered = cursorIdx >= 0 ? rows.slice(cursorIdx + 1) : rows;
      }
      const hasMore = filtered.length > limit;
      const page = hasMore ? filtered.slice(0, limit) : filtered;
      const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;
      return res.json({ data: page, pagination: { limit, nextCursor, hasMore } });
    }

    const { page, limit, offset } = parseOffsetPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });
    const countResult = await db.select({ count: count() }).from(notifications).where(eq(notifications.userId, userId));
    const total = countResult[0]?.count ?? 0;

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return sendListResponse(res, req, rows, buildOffsetMeta(page, limit, total));
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
