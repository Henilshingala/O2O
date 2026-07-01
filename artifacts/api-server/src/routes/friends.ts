import { Router } from "express";
import { db } from "@workspace/db";
import { friendsContacts, users } from "@workspace/db/schema";
import { and, eq, or, ilike, ne, count, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { rateLimit } from "express-rate-limit";
import { createNotification } from "./notifications";
import { getIo } from "../socket/index";
import { parseOffsetPagination, sendListResponse, buildOffsetMeta } from "../lib/pagination";
import { validateBody, friendRequestSchema, friendActionSchema, friendRemoveSchema } from "../lib/validation";

const router = Router();
router.use(requireAuth);

// GET /api/friends — list accepted friends
router.get("/", async (req: AuthRequest, res) => {
  try {
    const myId = req.user!.userId;
    const { page, limit, offset } = parseOffsetPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });

    const countResult = await db
      .select({ count: count() })
      .from(friendsContacts)
      .where(and(eq(friendsContacts.userId, myId), eq(friendsContacts.status, "accepted")));
    const total = countResult[0]?.count ?? 0;

    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        avatar: users.avatar,
        city: users.city,
        role: users.role,
      })
      .from(friendsContacts)
      .innerJoin(users, eq(users.id, friendsContacts.contactId))
      .where(and(eq(friendsContacts.userId, myId), eq(friendsContacts.status, "accepted")))
      .limit(limit)
      .offset(offset);
    return sendListResponse(res, req, rows, buildOffsetMeta(page, limit, total));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return res.status(500).json({ error: message });
  }
});

// GET /api/friends/requests — pending incoming requests
router.get("/requests", async (req: AuthRequest, res) => {
  try {
    const myId = req.user!.userId;
    const { page, limit, offset } = parseOffsetPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });

    const incomingCount = await db
      .select({ count: count() })
      .from(friendsContacts)
      .where(and(eq(friendsContacts.contactId, myId), eq(friendsContacts.status, "pending")));
    const outgoingCount = await db
      .select({ count: count() })
      .from(friendsContacts)
      .where(and(eq(friendsContacts.userId, myId), eq(friendsContacts.status, "pending")));

    const incoming = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        avatar: users.avatar,
        city: users.city,
        role: users.role,
      })
      .from(friendsContacts)
      .innerJoin(users, eq(users.id, friendsContacts.userId))
      .where(and(eq(friendsContacts.contactId, myId), eq(friendsContacts.status, "pending")))
      .limit(limit)
      .offset(offset);

    const outgoing = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        avatar: users.avatar,
        city: users.city,
        role: users.role,
      })
      .from(friendsContacts)
      .innerJoin(users, eq(users.id, friendsContacts.contactId))
      .where(and(eq(friendsContacts.userId, myId), eq(friendsContacts.status, "pending")))
      .limit(limit)
      .offset(offset);

    return res.json({
      incoming,
      outgoing,
      pagination: {
        incomingTotal: incomingCount[0]?.count ?? 0,
        outgoingTotal: outgoingCount[0]?.count ?? 0,
        page,
        limit,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return res.status(500).json({ error: message });
  }
});

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // Limit each IP to 10 requests per window
  message: { error: "Too many friend requests sent, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/friends/request — send friend request
router.post("/request", requestLimiter, validateBody(friendRequestSchema), async (req: AuthRequest, res) => {
  try {
    const myId = req.user!.userId;
    const { contactId } = req.body;
    if (!contactId) return res.status(400).json({ error: "contactId required" });
    if (contactId === myId) return res.status(400).json({ error: "Cannot add yourself" });

    const existing = await db
      .select()
      .from(friendsContacts)
      .where(
        or(
          and(eq(friendsContacts.userId, myId), eq(friendsContacts.contactId, contactId)),
          and(eq(friendsContacts.userId, contactId), eq(friendsContacts.contactId, myId))
        )
      );

    if (existing.length > 0) {
      const row = existing[0];
      if (row.status === "accepted") return res.status(400).json({ error: "Already friends" });
      if (row.status === "pending") return res.status(400).json({ error: "Request already sent" });
    }

    await db.insert(friendsContacts).values({ userId: myId, contactId, status: "pending" });

    const requester = await db.select().from(users).where(eq(users.id, myId)).limit(1);
    if (requester[0]) {
      await createNotification(
        contactId,
        "Friend Request",
        `${requester[0].fullName} sent you a friend request`,
        "friend_request",
        getIo()
      );
    }

    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/friends/accept
router.post("/accept", validateBody(friendActionSchema), async (req: AuthRequest, res) => {
  try {
    const myId = req.user!.userId;
    const { requesterId } = req.body;

    await db.transaction(async (tx) => {
      await tx
        .update(friendsContacts)
        .set({ status: "accepted" })
        .where(and(eq(friendsContacts.userId, requesterId), eq(friendsContacts.contactId, myId)));

      const existing = await tx
        .select()
        .from(friendsContacts)
        .where(and(eq(friendsContacts.userId, myId), eq(friendsContacts.contactId, requesterId)));

      if (existing.length === 0) {
        await tx.insert(friendsContacts).values({ userId: myId, contactId: requesterId, status: "accepted" });
      } else {
        await tx
          .update(friendsContacts)
          .set({ status: "accepted" })
          .where(and(eq(friendsContacts.userId, myId), eq(friendsContacts.contactId, requesterId)));
      }
    });

    const accepter = await db.select().from(users).where(eq(users.id, myId)).limit(1);
    if (accepter[0]) {
      await createNotification(
        requesterId,
        "Friend Accepted",
        `${accepter[0].fullName} accepted your friend request`,
        "friend_accepted",
        getIo()
      );
    }

    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/friends/reject
router.post("/reject", validateBody(friendActionSchema), async (req: AuthRequest, res) => {
  try {
    const myId = req.user!.userId;
    const { requesterId } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId required" });

    await db
      .delete(friendsContacts)
      .where(and(eq(friendsContacts.userId, requesterId), eq(friendsContacts.contactId, myId)));

    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/friends/cancel
router.post("/cancel", validateBody(friendRemoveSchema), async (req: AuthRequest, res) => {
  try {
    const myId = req.user!.userId;
    const { contactId } = req.body;
    if (!contactId) return res.status(400).json({ error: "contactId required" });

    await db
      .delete(friendsContacts)
      .where(and(eq(friendsContacts.userId, myId), eq(friendsContacts.contactId, contactId)));

    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// DELETE /api/friends/remove
router.delete("/remove", validateBody(friendRemoveSchema), async (req: AuthRequest, res) => {
  try {
    const myId = req.user!.userId;
    const { contactId } = req.body;
    if (!contactId) return res.status(400).json({ error: "contactId required" });

    await db
      .delete(friendsContacts)
      .where(
        or(
          and(eq(friendsContacts.userId, myId), eq(friendsContacts.contactId, contactId)),
          and(eq(friendsContacts.userId, contactId), eq(friendsContacts.contactId, myId))
        )
      );

    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/friends/search
router.get("/search", async (req: AuthRequest, res) => {
  try {
    const myId = req.user!.userId;
    const q = String(req.query.q || "").trim();
    if (!q || q.length < 2) return res.json([]);

    const page = Math.max(1, parseInt(String(req.query.page ?? 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 20), 10) || 20));
    const offset = (page - 1) * limit;
    const lq = q.toLowerCase();

    const matched = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        avatar: users.avatar,
        city: users.city,
        role: users.role,
      })
      .from(users)
      .where(
        and(
          ne(users.id, myId),
          or(
            ilike(users.username, `%${lq}%`),
            ilike(users.fullName, `%${lq}%`)
          )
        )
      )
      .limit(limit)
      .offset(offset);

    const allRelations = await db
      .select()
      .from(friendsContacts)
      .where(
        or(
          eq(friendsContacts.userId, myId),
          eq(friendsContacts.contactId, myId)
        )
      );

    const withStatus = matched.map((u) => {
      const sent = allRelations.find(r => r.userId === myId && r.contactId === u.id);
      const received = allRelations.find(r => r.userId === u.id && r.contactId === myId);
      let relationship: "none" | "friends" | "pending_sent" | "pending_received" = "none";
      if (sent?.status === "accepted" || received?.status === "accepted") relationship = "friends";
      else if (sent?.status === "pending") relationship = "pending_sent";
      else if (received?.status === "pending") relationship = "pending_received";
      return { ...u, relationship };
    });

    return res.json(withStatus);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return res.status(500).json({ error: message });
  }
});

export default router;
