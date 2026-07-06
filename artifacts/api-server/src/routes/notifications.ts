import { Router } from "express";
import { db } from "@workspace/db";
import { notifications } from "@workspace/db/schema";
import { eq, desc, and, lt, count } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { parseCursorPagination, sendListResponse, buildOffsetMeta, parseOffsetPagination } from "../lib/pagination";

const router = Router();
router.use(requireAuth);

// Use UUID to eliminate timestamp-collision risk for concurrent inserts
const genId = (prefix: string) => `${prefix}_${randomUUID()}`;

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
    const cursorMode = typeof req.query.cursor === "string";

    if (cursorMode) {
      const { limit, cursor } = parseCursorPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });

      // Proper cursor pagination: use WHERE clause instead of in-memory filtering
      const whereClause = cursor
        ? and(eq(notifications.userId, userId), lt(notifications.id, cursor))
        : eq(notifications.userId, userId);

      const rows = await db
        .select()
        .from(notifications)
        .where(whereClause)
        .orderBy(desc(notifications.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
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
  } catch {
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
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
