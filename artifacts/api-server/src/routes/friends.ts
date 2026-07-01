import { Router } from "express";
import { db, pool } from "@workspace/db";
import { friendsContacts, users } from "@workspace/db/schema";
import { and, eq, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

// GET /api/friends — list accepted friends
router.get("/", async (req: any, res) => {
  try {
    const myId = req.userId;
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
      .where(and(eq(friendsContacts.userId, myId), eq(friendsContacts.status, "accepted")));
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/friends/requests — pending incoming requests
router.get("/requests", async (req: any, res) => {
  try {
    const myId = req.userId;
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
      .where(and(eq(friendsContacts.contactId, myId), eq(friendsContacts.status, "pending")));

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
      .where(and(eq(friendsContacts.userId, myId), eq(friendsContacts.status, "pending")));

    res.json({ incoming, outgoing });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/friends/request — send friend request
router.post("/request", async (req: any, res) => {
  try {
    const myId = req.userId;
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
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/friends/accept — accept a pending request
router.post("/accept", async (req: any, res) => {
  try {
    const myId = req.userId;
    const { requesterId } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId required" });

    // Update the original request to accepted
    await db
      .update(friendsContacts)
      .set({ status: "accepted" })
      .where(and(eq(friendsContacts.userId, requesterId), eq(friendsContacts.contactId, myId)));

    // Insert reverse row so both sides can list each other as friends
    const existing = await db
      .select()
      .from(friendsContacts)
      .where(and(eq(friendsContacts.userId, myId), eq(friendsContacts.contactId, requesterId)));

    if (existing.length === 0) {
      await db.insert(friendsContacts).values({ userId: myId, contactId: requesterId, status: "accepted" });
    } else {
      await db
        .update(friendsContacts)
        .set({ status: "accepted" })
        .where(and(eq(friendsContacts.userId, myId), eq(friendsContacts.contactId, requesterId)));
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/friends/reject — reject a pending request
router.post("/reject", async (req: any, res) => {
  try {
    const myId = req.userId;
    const { requesterId } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId required" });

    await db
      .delete(friendsContacts)
      .where(and(eq(friendsContacts.userId, requesterId), eq(friendsContacts.contactId, myId)));

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/friends/cancel — cancel outgoing request
router.post("/cancel", async (req: any, res) => {
  try {
    const myId = req.userId;
    const { contactId } = req.body;
    if (!contactId) return res.status(400).json({ error: "contactId required" });

    await db
      .delete(friendsContacts)
      .where(and(eq(friendsContacts.userId, myId), eq(friendsContacts.contactId, contactId)));

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/friends/remove — remove a friend
router.delete("/remove", async (req: any, res) => {
  try {
    const myId = req.userId;
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

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/friends/search?q= — search users
router.get("/search", async (req: any, res) => {
  try {
    const myId = req.userId;
    const q = String(req.query.q || "").trim();
    if (!q || q.length < 2) return res.json([]);

    const lq = q.toLowerCase();

    // Fetch all users except self, then filter in JS to avoid drizzle ILIKE issues
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        avatar: users.avatar,
        city: users.city,
        role: users.role,
      })
      .from(users);

    const matched = allUsers
      .filter(u => u.id !== myId &&
        (u.username.toLowerCase().includes(lq) || u.fullName.toLowerCase().includes(lq)))
      .slice(0, 20);

    // Attach relationship status
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

    res.json(withStatus);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
