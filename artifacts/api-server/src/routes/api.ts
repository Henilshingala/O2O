import { Router } from "express";
import { db } from "@workspace/db";
import { eq, or, and, inArray, desc, asc, isNull, lt, count, sql } from "drizzle-orm";
import * as schema from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { createNotification } from "./notifications";
import { emitToChat, emitToBid, emitToUser, emitToGroup, emitToChannel } from "../socket/index";
import { parseOffsetPagination, parseCursorPagination, buildOffsetMeta, sendListResponse } from "../lib/pagination";
import {
  validateBody,
  createChannelSchema,
  createProductSchema,
  createBidSchema,
  createReviewSchema,
  orderStatusSchema,
  winnerSchema,
  rejectBidSchema,
  createChatSchema,
  sendMessageSchema,
  wishlistSchema,
} from "../lib/validation";

const router = Router();
router.use(requireAuth);

const genId = (prefix: string) => `${prefix}_${Date.now()}`;

async function enrichOrdersWithSellerName<T extends { sellerId: string }>(rows: T[]) {
  const sellerIds = [...new Set(rows.map((o) => o.sellerId))];
  if (sellerIds.length === 0) return rows.map((o) => ({ ...o, sellerName: "Seller" }));
  const sellers = await db.select({ id: schema.users.id, fullName: schema.users.fullName }).from(schema.users).where(inArray(schema.users.id, sellerIds));
  const nameMap = Object.fromEntries(sellers.map((s) => [s.id, s.fullName ?? "Seller"]));
  return rows.map((o) => ({ ...o, sellerName: nameMap[o.sellerId] ?? "Seller" }));
}

async function areFriends(userId: string, otherId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(schema.friendsContacts)
    .where(
      and(
        eq(schema.friendsContacts.userId, userId),
        eq(schema.friendsContacts.contactId, otherId),
        eq(schema.friendsContacts.status, "accepted")
      )
    );
  return rows.length > 0;
}

async function loadProductsWithImages(channelIds: string[], productLimit = 50) {
  if (channelIds.length === 0) return new Map<string, Array<typeof schema.products.$inferSelect & { images: { id: string; url: string; isPrimary: boolean }[] }>>();
  const prods = await db.select().from(schema.products).where(inArray(schema.products.channelId, channelIds)).limit(productLimit * channelIds.length);
  const productIds = prods.map((p) => p.id);
  let images: typeof schema.productImages.$inferSelect[] = [];
  if (productIds.length > 0) {
    images = await db.select().from(schema.productImages).where(inArray(schema.productImages.productId, productIds));
  }
  const byChannel = new Map<string, Array<typeof schema.products.$inferSelect & { images: { id: string; url: string; isPrimary: boolean }[] }>>();
  for (const prod of prods) {
    const prodImages = images
      .filter((img) => img.productId === prod.id)
      .map((img) => ({ id: img.id, url: img.url, isPrimary: img.isPrimary }));
    const entry = { ...prod, images: prodImages, videoUrl: (prod.details as { name: string; value: string }[] | null)?.find((d) => d.name === "__videoUrl")?.value };
    const list = byChannel.get(prod.channelId) ?? [];
    list.push(entry);
    byChannel.set(prod.channelId, list);
  }
  return byChannel;
}

// --- CHANNELS & PRODUCTS ---
router.get("/channels", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    // Security: Only fetch public channels or channels the user owns/follows
    // For simplicity with Drizzle without complex joins in this migration, we do it via a subquery or in two steps.
    const userFollows = await db.select({ channelId: schema.channelFollowers.channelId }).from(schema.channelFollowers).where(eq(schema.channelFollowers.userId, userId));
    const followedIds = userFollows.map(f => f.channelId);

    let whereClause = or(
      eq(schema.channels.visibility, "public"),
      eq(schema.channels.ownerId, userId)
    );
    if (followedIds.length > 0) {
      whereClause = or(whereClause, inArray(schema.channels.id, followedIds));
    }

    const { page, limit, offset } = parseOffsetPagination(req.query as Record<string, unknown>, { limit: 20, maxLimit: 50 });

    const countResult = await db.select({ count: count() }).from(schema.channels).where(whereClause!);
    const total = countResult[0]?.count ?? 0;

    const allChannels = await db.select()
      .from(schema.channels)
      .where(whereClause)
      .orderBy(desc(schema.channels.createdAt))
      .limit(limit)
      .offset(offset);

    const channelIds = allChannels.map((c) => c.id);
    const productsByChannel = await loadProductsWithImages(channelIds);
    let fols: typeof schema.channelFollowers.$inferSelect[] = [];
    if (channelIds.length > 0) {
      fols = await db.select().from(schema.channelFollowers).where(inArray(schema.channelFollowers.channelId, channelIds));
    }

    const channelsWithDetails = allChannels.map((c) => ({
      ...c,
      image: c.logo,
      products: productsByChannel.get(c.id) ?? [],
      followers: fols.filter((f) => f.channelId === c.id).map((f) => f.userId),
      messages: [], // Eager loading messages removed to prevent OOM
    }));
    return sendListResponse(res, req, channelsWithDetails, buildOffsetMeta(page, limit, total));
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/channels", validateBody(createChannelSchema), async (req: AuthRequest, res) => {
  try {
    const id = genId("ch");
    const { image, ...rest } = req.body;
    const newChannel = { ...rest, id, ownerId: req.user!.userId, logo: image || null };
    await db.transaction(async (tx) => {
      await tx.insert(schema.channels).values(newChannel);
    });
    return res.json({ ...newChannel, image: newChannel.logo, products: [], followers: [], messages: [] });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/channels/:id/products", async (req: AuthRequest, res) => {
  try {
    const id = genId("prod");
    const { images, videoUrl, ...body } = req.body;
    const imageUrl = body.image || (Array.isArray(images) && images.length > 0 ? images[0] : null);
    const details = [...(body.details || [])];
    if (videoUrl) {
      details.push({ name: "__videoUrl", value: videoUrl });
    }
    const newProduct = { ...body, id, channelId: req.params.id as string, details, image: imageUrl };
    await db.insert(schema.products).values(newProduct);

    const imageUrls: string[] = Array.isArray(images) && images.length > 0
      ? images
      : imageUrl
        ? [imageUrl]
        : [];

    if (imageUrls.length > 0) {
      await db.insert(schema.productImages).values(
        imageUrls.map((url: string, idx: number) => ({
          id: genId("pimg"),
          productId: id,
          url,
          isPrimary: idx === 0,
        }))
      );
    }

    return res.json({
      ...newProduct,
      videoUrl: videoUrl || undefined,
      images: imageUrls.map((url: string, idx: number) => ({
        id: `${id}_img_${idx}`,
        url,
        isPrimary: idx === 0,
      })),
    });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/channels/:id/follow", async (req: AuthRequest, res) => {
  try {
    const channelId = req.params.id as string;
    const userId = req.user!.userId;
    const existing = await db.select().from(schema.channelFollowers).where(and(eq(schema.channelFollowers.channelId, channelId), eq(schema.channelFollowers.userId, userId)));
    if (existing.length > 0) {
      await db.delete(schema.channelFollowers).where(and(eq(schema.channelFollowers.channelId, channelId), eq(schema.channelFollowers.userId, userId)));
    } else {
      await db.insert(schema.channelFollowers).values({ channelId, userId });
    }
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.get("/channels/:id/messages", async (req: AuthRequest, res) => {
  try {
    const channelId = req.params.id as string;
    const { limit, cursor } = parseCursorPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });

    let whereClause = and(eq(schema.messages.channelId, channelId), isNull(schema.messages.deletedAt));
    if (cursor) {
      const cursorRow = await db.select({ ts: schema.messages.timestamp }).from(schema.messages).where(eq(schema.messages.id, cursor)).limit(1);
      if (cursorRow[0]) {
        whereClause = and(whereClause, lt(schema.messages.timestamp, cursorRow[0].ts));
      }
    }

    const msgs = await db.select().from(schema.messages)
      .where(whereClause)
      .orderBy(desc(schema.messages.timestamp))
      .limit(limit + 1);

    const hasMore = msgs.length > limit;
    const page = hasMore ? msgs.slice(0, limit) : msgs;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;
    return res.json({ messages: page.reverse(), nextCursor });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/channels/:id/messages", async (req: AuthRequest, res) => {
  try {
    const channelId = req.params.id as string;
    const channel = await db.select().from(schema.channels).where(eq(schema.channels.id, channelId)).limit(1);
    if (!channel[0]) return res.status(404).json({ error: "Channel not found" });
    if (channel[0].ownerId !== req.user!.userId) {
      return res.status(403).json({ error: "Only channel owner can post" });
    }
    const id = genId("msg");
    const { timestamp, ...restBody } = req.body;
    const newMsg = {
      ...restBody,
      id,
      channelId,
      senderId: req.user!.userId,
      type: req.body.type || "text",
      metadata: req.body.metadata || {},
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    };
    await db.insert(schema.messages).values(newMsg);
    emitToChannel(channelId, "message:new", newMsg);
    return res.json(newMsg);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.patch("/channels/:id", async (req: AuthRequest, res) => {
  try {
    const channelId = req.params.id as string;
    const channel = await db.select().from(schema.channels).where(eq(schema.channels.id, channelId)).limit(1);
    if (!channel[0]) return res.status(404).json({ error: "Channel not found" });
    if (channel[0].ownerId !== req.user!.userId) {
      return res.status(403).json({ error: "Only channel owner can edit" });
    }
    const { name, description, image, logo } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    const logoVal = logo ?? image;
    if (logoVal !== undefined) updates.logo = logoVal;
    await db.update(schema.channels).set(updates).where(eq(schema.channels.id, channelId));
    const updated = await db.select().from(schema.channels).where(eq(schema.channels.id, channelId)).limit(1);
    const fols = await db.select().from(schema.channelFollowers).where(eq(schema.channelFollowers.channelId, channelId));
    return res.json({
      ...updated[0],
      image: updated[0]?.logo,
      followers: fols.map((f) => f.userId),
      products: [],
      messages: [],
    });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.delete("/channels/:id", async (req: AuthRequest, res) => {
  try {
    const channelId = req.params.id as string;
    const channel = await db.select().from(schema.channels).where(eq(schema.channels.id, channelId)).limit(1);
    if (!channel[0]) return res.status(404).json({ error: "Channel not found" });
    if (channel[0].ownerId !== req.user!.userId) {
      return res.status(403).json({ error: "Only channel owner can delete" });
    }
    await db.transaction(async (tx) => {
      await tx.delete(schema.channelFollowers).where(eq(schema.channelFollowers.channelId, channelId));
      await tx.delete(schema.channels).where(eq(schema.channels.id, channelId));
    });
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/channels/:id/transfer", async (req: AuthRequest, res) => {
  try {
    const channelId = req.params.id as string;
    const { newOwnerId } = req.body;
    if (!newOwnerId) return res.status(400).json({ error: "newOwnerId required" });
    const channel = await db.select().from(schema.channels).where(eq(schema.channels.id, channelId)).limit(1);
    if (!channel[0]) return res.status(404).json({ error: "Channel not found" });
    if (channel[0].ownerId !== req.user!.userId) {
      return res.status(403).json({ error: "Only channel owner can transfer ownership" });
    }
    await db.update(schema.channels).set({ ownerId: newOwnerId }).where(eq(schema.channels.id, channelId));
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.delete("/channels/:id/followers/:userId", async (req: AuthRequest, res) => {
  try {
    const channelId = req.params.id as string;
    const followerId = req.params.userId as string;
    const channel = await db.select().from(schema.channels).where(eq(schema.channels.id, channelId)).limit(1);
    if (!channel[0]) return res.status(404).json({ error: "Channel not found" });
    if (channel[0].ownerId !== req.user!.userId) {
      return res.status(403).json({ error: "Only channel owner can manage followers" });
    }
    await db.delete(schema.channelFollowers).where(
      and(eq(schema.channelFollowers.channelId, channelId), eq(schema.channelFollowers.userId, followerId))
    );
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/channels/:id/products/:productId/repost", async (req: AuthRequest, res) => {
  try {
    const channelId = req.params.id as string;
    const productId = req.params.productId as string;
    const channel = await db.select().from(schema.channels).where(eq(schema.channels.id, channelId)).limit(1);
    if (!channel[0]) return res.status(404).json({ error: "Channel not found" });
    if (channel[0].ownerId !== req.user!.userId) {
      return res.status(403).json({ error: "Only channel owner can repost" });
    }
    const original = await db.select().from(schema.products).where(eq(schema.products.id, productId)).limit(1);
    if (!original[0]) return res.status(404).json({ error: "Product not found" });

    const newId = genId("prod");
    const updates = req.body || {};
    const newProduct = {
      id: newId,
      channelId,
      name: updates.name ?? original[0].name,
      description: updates.description ?? original[0].description,
      price: updates.price ?? original[0].price,
      image: updates.image ?? original[0].image,
      details: updates.details ?? original[0].details,
      views: 0,
    };
    await db.insert(schema.products).values(newProduct);

    const images = await db.select().from(schema.productImages).where(eq(schema.productImages.productId, productId));
    if (images.length > 0) {
      await db.insert(schema.productImages).values(
        images.map((img) => ({
          id: genId("pimg"),
          productId: newId,
          url: img.url,
          isPrimary: img.isPrimary,
        }))
      );
    }
    return res.json(newProduct);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

// --- WISHLIST ---
router.get("/wishlist", async (req: AuthRequest, res) => {
  try {
    const { page, limit, offset } = parseOffsetPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });
    const userId = req.user!.userId;
    const countResult = await db.select({ count: count() }).from(schema.wishlist).where(eq(schema.wishlist.userId, userId));
    const total = countResult[0]?.count ?? 0;
    const list = await db.select().from(schema.wishlist).where(eq(schema.wishlist.userId, userId)).limit(limit).offset(offset);
    return sendListResponse(res, req, list, buildOffsetMeta(page, limit, total));
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/wishlist", validateBody(wishlistSchema), async (req: AuthRequest, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user!.userId;
    const existing = await db.select().from(schema.wishlist).where(and(eq(schema.wishlist.productId, productId), eq(schema.wishlist.userId, userId)));
    if (existing.length > 0) {
      await db.delete(schema.wishlist).where(and(eq(schema.wishlist.productId, productId), eq(schema.wishlist.userId, userId)));
    } else {
      await db.insert(schema.wishlist).values({ productId, userId });
    }
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

// --- CHATS & GROUPS ---
router.get("/chats", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { page, limit, offset } = parseOffsetPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });
    const parts = await db.select().from(schema.chatParticipants).where(eq(schema.chatParticipants.userId, userId));
    const chatIds = parts.map(p => p.chatId);
    if (chatIds.length === 0) return sendListResponse(res, req, [], buildOffsetMeta(page, limit, 0));

    const total = chatIds.length;
    const paginatedChatIds = chatIds.slice(offset, offset + limit);
    const myChats = await db.select().from(schema.chats).where(inArray(schema.chats.id, paginatedChatIds));
    const allParts = await db.select().from(schema.chatParticipants).where(inArray(schema.chatParticipants.chatId, paginatedChatIds));

    const msgResults = await Promise.all(
      paginatedChatIds.map(id =>
        db.select().from(schema.messages)
          .where(and(eq(schema.messages.chatId, id), isNull(schema.messages.deletedAt)))
          .orderBy(desc(schema.messages.timestamp))
          .limit(50)
      )
    );
    const allMsgs = msgResults.flat();

    const enriched = myChats.map(c => ({
      ...c,
      participants: allParts.filter(p => p.chatId === c.id).map(p => p.userId),
      messages: allMsgs
        .filter(m => m.chatId === c.id)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    }));
    return sendListResponse(res, req, enriched, buildOffsetMeta(page, limit, total));
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/chats", validateBody(createChatSchema), async (req: AuthRequest, res) => {
  try {
    const { myId, otherId } = req.body;
    const userId = req.user!.userId;
    if (userId !== myId) return res.status(403).json({ error: "Forbidden" });
    if (!(await areFriends(myId, otherId))) {
      return res.status(403).json({ error: "You can only chat with accepted friends" });
    }

    const existingParts = await db.select().from(schema.chatParticipants).where(eq(schema.chatParticipants.userId, myId));
    const myChatIds = existingParts.map((p) => p.chatId);
    if (myChatIds.length > 0) {
      const shared = await db
        .select()
        .from(schema.chatParticipants)
        .where(and(inArray(schema.chatParticipants.chatId, myChatIds), eq(schema.chatParticipants.userId, otherId)));
      if (shared.length > 0) {
        const chatId = shared[0].chatId;
        return res.json({ id: chatId, participants: [myId, otherId], messages: [] });
      }
    }

    const id = genId("chat");
    await db.transaction(async (tx) => {
      await tx.insert(schema.chats).values({ id });
      await tx.insert(schema.chatParticipants).values([{ chatId: id, userId: myId }, { chatId: id, userId: otherId }]);
    });
    return res.json({ id, participants: [myId, otherId], messages: [] });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/chats/:id/messages", async (req: AuthRequest, res) => {
  try {
    const chatId = req.params.id as string;
    const parts = await db.select().from(schema.chatParticipants).where(eq(schema.chatParticipants.chatId, chatId));
    const participantIds = parts.map((p) => p.userId);
    if (!participantIds.includes(req.user!.userId)) {
      return res.status(403).json({ error: "Not a chat participant" });
    }
    const otherId = participantIds.find((id) => id !== req.user!.userId);
    if (otherId && !(await areFriends(req.user!.userId, otherId))) {
      return res.status(403).json({ error: "You can only chat with accepted friends" });
    }
    const id = genId("msg");
    const { timestamp, ...restBody } = req.body;
    const newMsg = {
      ...restBody,
      id,
      chatId,
      senderId: req.user!.userId,
      type: req.body.type || "text",
      metadata: req.body.metadata || {},
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    };
    await db.insert(schema.messages).values(newMsg);
    await db.update(schema.chats).set({ updatedAt: new Date() }).where(eq(schema.chats.id, chatId));
    emitToChat(chatId, "message:new", newMsg);
    if (otherId) {
      await createNotification(otherId, "New Message", req.body.text?.slice(0, 80) || "New message", "new_message", null);
      emitToUser(otherId, "notification:new", { type: "new_message" });
    }
    return res.json(newMsg);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.get("/chats/:id/messages", async (req: AuthRequest, res) => {
  try {
    const chatId = req.params.id as string;
    const parts = await db.select().from(schema.chatParticipants).where(eq(schema.chatParticipants.chatId, chatId));
    if (!parts.some((p) => p.userId === req.user!.userId)) {
      return res.status(403).json({ error: "Not a chat participant" });
    }
    const { limit, cursor } = parseCursorPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });

    let whereClause = and(eq(schema.messages.chatId, chatId), isNull(schema.messages.deletedAt));
    if (cursor) {
      const cursorRow = await db.select({ ts: schema.messages.timestamp }).from(schema.messages).where(eq(schema.messages.id, cursor)).limit(1);
      if (cursorRow[0]) {
        whereClause = and(whereClause, lt(schema.messages.timestamp, cursorRow[0].ts));
      }
    }

    const msgs = await db.select().from(schema.messages)
      .where(whereClause)
      .orderBy(desc(schema.messages.timestamp))
      .limit(limit + 1);

    const hasMore = msgs.length > limit;
    const page = hasMore ? msgs.slice(0, limit) : msgs;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;
    return res.json({ messages: page.reverse(), nextCursor });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.patch("/chats/:chatId/messages/:messageId", async (req: AuthRequest, res) => {
  try {
    const { chatId, messageId } = req.params;
    const msg = await db.select().from(schema.messages).where(eq(schema.messages.id, messageId as string)).limit(1);
    if (!msg[0] || msg[0].senderId !== req.user!.userId) return res.status(403).json({ error: "Forbidden" });
    await db.update(schema.messages).set({ text: req.body.text, editedAt: new Date() }).where(eq(schema.messages.id, messageId as string));
    emitToChat(chatId as string, "message:edit", { id: messageId, text: req.body.text });
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.delete("/chats/:chatId/messages/:messageId", async (req: AuthRequest, res) => {
  try {
    const { chatId, messageId } = req.params;
    const msg = await db.select().from(schema.messages).where(eq(schema.messages.id, messageId as string)).limit(1);
    if (!msg[0] || msg[0].senderId !== req.user!.userId) return res.status(403).json({ error: "Forbidden" });
    await db.update(schema.messages).set({ deletedAt: new Date(), text: "Message deleted" }).where(eq(schema.messages.id, messageId as string));
    emitToChat(chatId as string, "message:delete", { id: messageId });
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.get("/groups", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { page, limit, offset } = parseOffsetPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });
    const parts = await db.select().from(schema.groupMembers).where(eq(schema.groupMembers.userId, userId));
    const groupIds = parts.map(p => p.groupId);
    if (groupIds.length === 0) return sendListResponse(res, req, [], buildOffsetMeta(page, limit, 0));

    const total = groupIds.length;
    const paginatedGroupIds = groupIds.slice(offset, offset + limit);
    const myGroups = await db.select().from(schema.groups).where(inArray(schema.groups.id, paginatedGroupIds));
    const allParts = await db.select().from(schema.groupMembers).where(inArray(schema.groupMembers.groupId, paginatedGroupIds));

    const msgResults = await Promise.all(
      paginatedGroupIds.map(id =>
        db.select().from(schema.messages)
          .where(eq(schema.messages.groupId, id))
          .orderBy(desc(schema.messages.timestamp))
          .limit(50)
      )
    );
    const allMsgs = msgResults.flat();

    const enriched = myGroups.map(g => ({
      ...g,
      members: allParts.filter(p => p.groupId === g.id).map(p => p.userId),
      messages: allMsgs.filter(m => m.groupId === g.id).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    }));
    return sendListResponse(res, req, enriched, buildOffsetMeta(page, limit, total));
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/groups", async (req: AuthRequest, res) => {
  try {
    const id = genId("grp");
    const { members: memberList, ...groupBody } = req.body;
    const newGroup = { name: groupBody.name, description: groupBody.description, image: groupBody.image || null, id, createdBy: req.user!.userId };
    const members = memberList || [req.user!.userId];
    const memberRows = members.map((m: string) => ({ groupId: id, userId: m }));

    await db.transaction(async (tx) => {
      await tx.insert(schema.groups).values(newGroup);
      await tx.insert(schema.groupMembers).values(memberRows);
    });
    
    return res.json({ ...newGroup, members, messages: [] });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/groups/:id/messages", async (req: AuthRequest, res) => {
  try {
    const groupId = req.params.id as string;
    const membership = await db.select().from(schema.groupMembers).where(
      and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, req.user!.userId))
    );
    if (membership.length === 0) {
      return res.status(403).json({ error: "Not a group member" });
    }
    const id = genId("msg");
    const { timestamp, ...restBody } = req.body;
    const newMsg = {
      ...restBody,
      id,
      groupId,
      senderId: req.user!.userId,
      type: req.body.type || "text",
      metadata: req.body.metadata || {},
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    };
    await db.insert(schema.messages).values(newMsg);
    emitToGroup(groupId, "message:new", newMsg);
    return res.json(newMsg);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.get("/groups/:id/messages", async (req: AuthRequest, res) => {
  try {
    const groupId = req.params.id as string;
    const membership = await db.select().from(schema.groupMembers).where(
      and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, req.user!.userId))
    );
    if (membership.length === 0) return res.status(403).json({ error: "Not a group member" });

    const { limit, cursor } = parseCursorPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });
    let whereClause = and(eq(schema.messages.groupId, groupId), isNull(schema.messages.deletedAt));
    if (cursor) {
      const cursorRow = await db.select({ ts: schema.messages.timestamp }).from(schema.messages).where(eq(schema.messages.id, cursor)).limit(1);
      if (cursorRow[0]) {
        whereClause = and(whereClause, lt(schema.messages.timestamp, cursorRow[0].ts));
      }
    }
    const msgs = await db.select().from(schema.messages)
      .where(whereClause)
      .orderBy(desc(schema.messages.timestamp))
      .limit(limit + 1);
    const hasMore = msgs.length > limit;
    const page = hasMore ? msgs.slice(0, limit) : msgs;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;
    return res.json({ messages: page.reverse(), nextCursor });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.patch("/groups/:id", async (req: AuthRequest, res) => {
  try {
    const groupId = req.params.id as string;
    const group = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
    if (!group[0]) return res.status(404).json({ error: "Group not found" });
    if (group[0].createdBy !== req.user!.userId) {
      return res.status(403).json({ error: "Only group creator can edit" });
    }
    const { name, description, image } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (image !== undefined) updates.image = image;
    await db.update(schema.groups).set(updates).where(eq(schema.groups.id, groupId));
    const updated = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
    const members = await db.select().from(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId));
    return res.json({ ...updated[0], members: members.map((m) => m.userId), messages: [] });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/groups/:id/members", async (req: AuthRequest, res) => {
  try {
    const groupId = req.params.id as string;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const group = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
    if (!group[0]) return res.status(404).json({ error: "Group not found" });
    if (group[0].createdBy !== req.user!.userId) {
      return res.status(403).json({ error: "Only group creator can add members" });
    }
    const existing = await db.select().from(schema.groupMembers).where(
      and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId))
    );
    if (existing.length === 0) {
      await db.insert(schema.groupMembers).values({ groupId, userId });
    }
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.delete("/groups/:id/members/:userId", async (req: AuthRequest, res) => {
  try {
    const groupId = req.params.id as string;
    const memberId = req.params.userId as string;
    const group = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
    if (!group[0]) return res.status(404).json({ error: "Group not found" });
    if (group[0].createdBy !== req.user!.userId && memberId !== req.user!.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.delete(schema.groupMembers).where(
      and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, memberId))
    );
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.delete("/groups/:id", async (req: AuthRequest, res) => {
  try {
    const groupId = req.params.id as string;
    const group = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
    if (!group[0]) return res.status(404).json({ error: "Group not found" });
    if (group[0].createdBy !== req.user!.userId) {
      return res.status(403).json({ error: "Only group owner can delete" });
    }
    await db.transaction(async (tx) => {
      await tx.delete(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId));
      await tx.delete(schema.groups).where(eq(schema.groups.id, groupId));
    });
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/groups/:id/transfer", async (req: AuthRequest, res) => {
  try {
    const groupId = req.params.id as string;
    const { newOwnerId } = req.body;
    if (!newOwnerId) return res.status(400).json({ error: "newOwnerId required" });
    const group = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
    if (!group[0]) return res.status(404).json({ error: "Group not found" });
    if (group[0].createdBy !== req.user!.userId) {
      return res.status(403).json({ error: "Only group owner can transfer ownership" });
    }
    const member = await db.select().from(schema.groupMembers).where(
      and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, newOwnerId))
    );
    if (member.length === 0) {
      await db.insert(schema.groupMembers).values({ groupId, userId: newOwnerId });
    }
    await db.update(schema.groups).set({ createdBy: newOwnerId }).where(eq(schema.groups.id, groupId));
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

// --- BIDS ---
router.get("/bids", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { page, limit, offset } = parseOffsetPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });

    const sellerChannels = await db.select({ id: schema.channels.id }).from(schema.channels).where(eq(schema.channels.ownerId, userId));
    const channelIds = sellerChannels.map((c) => c.id);

    let bidWhere = eq(schema.bids.buyerId, userId);
    if (channelIds.length > 0) {
      bidWhere = or(
        eq(schema.bids.buyerId, userId),
        eq(schema.bids.allSellers, true),
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${schema.bids.selectedSellers}) elem WHERE elem = ANY(${channelIds}))`,
      ) as typeof bidWhere;
    }

    const countResult = await db.select({ count: count() }).from(schema.bids).where(bidWhere);
    const total = countResult[0]?.count ?? 0;

    const allBids = await db.select().from(schema.bids).where(bidWhere).orderBy(desc(schema.bids.createdAt)).limit(limit).offset(offset);
    const bidIds = allBids.map(b => b.id);
    let offers: any[] = [];
    let rejs: any[] = [];
    if (bidIds.length > 0) {
      offers = await db.select().from(schema.bidOffers).where(inArray(schema.bidOffers.bidId, bidIds));
      rejs = await db.select().from(schema.bidRejections).where(inArray(schema.bidRejections.bidId, bidIds));
    }
    const enriched = allBids.map(b => {
      let bidOffers = offers.filter(o => o.bidId === b.id);
      if (b.buyerId !== userId) {
        bidOffers = bidOffers.map((o) => {
          if (o.sellerId === userId) return o;
          return { ...o, sellerId: "hidden", sellerName: "Competitor", channelId: "hidden" };
        });
      }
      return {
        ...b,
        offers: bidOffers,
        rejections: rejs.filter(r => r.bidId === b.id),
      };
    });
    return sendListResponse(res, req, enriched, buildOffsetMeta(page, limit, total));
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/bids", validateBody(createBidSchema), async (req: AuthRequest, res) => {
  try {
    const id = genId("bid");
    const endTime = req.body.endTime ? new Date(req.body.endTime) : new Date(Date.now() + 30 * 60 * 1000);
    const newBid = { ...req.body, id, buyerId: req.user!.userId, selectedSellers: req.body.selectedSellers || [], endTime };
    await db.insert(schema.bids).values(newBid);
    return res.json({ ...newBid, offers: [], rejections: [] });
  } catch (error: any) { console.error("BID ERROR:", error); return res.status(500).json({ error: "Server error", detail: error.message }); }
});

router.post("/bids/:id/offers", async (req: AuthRequest, res) => {
  try {
    const bidId = req.params.id as string;
    const sellerId = req.user!.userId;
    const { channelId, price, deliveryTime, message, sellerName, rating } = req.body;
    if (!channelId || price == null || !deliveryTime) {
      return res.status(400).json({ error: "channelId, price, and deliveryTime required" });
    }

    const bid = await db.select().from(schema.bids).where(eq(schema.bids.id, bidId)).limit(1);
    if (!bid[0] || bid[0].status !== "active") {
      return res.status(400).json({ error: "Bid is not active" });
    }
    if (new Date(bid[0].endTime) < new Date()) {
      return res.status(400).json({ error: "Bid has ended" });
    }

    const existing = await db.select().from(schema.bidOffers).where(
      and(eq(schema.bidOffers.bidId, bidId), eq(schema.bidOffers.sellerId, sellerId), eq(schema.bidOffers.channelId, channelId))
    );

    let newOffer;
    if (existing[0]) {
      await db.update(schema.bidOffers).set({
        price,
        deliveryTime,
        message: message ?? "",
        timestamp: new Date(),
      }).where(eq(schema.bidOffers.id, existing[0].id));
      newOffer = { ...existing[0], price, deliveryTime, message: message ?? "", timestamp: new Date(), sellerName, rating };
    } else {
      const id = genId("off");
      const dbOffer = { id, bidId, sellerId, channelId, price, deliveryTime, message: message ?? "" };
      await db.insert(schema.bidOffers).values(dbOffer);
      newOffer = { ...dbOffer, sellerName, rating, timestamp: new Date() };
    }

    emitToBid(bidId, "bid:offer", newOffer);
    await createNotification(bid[0].buyerId, "New Bid Offer", `Updated offer on ${bid[0].productName}`, "bid_offer", null);
    emitToUser(bid[0].buyerId, "notification:new", { type: "bid_offer" });
    return res.json(newOffer);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/bids/:id/winner", validateBody(winnerSchema), async (req: AuthRequest, res) => {
  try {
    const bidId = req.params.id as string;
    const { winnerId, winnerChannelId } = req.body;
    const bidRows = await db.select().from(schema.bids).where(eq(schema.bids.id, bidId)).limit(1);
    const bid = bidRows[0];
    if (!bid) return res.status(404).json({ error: "Bid not found" });
    if (bid.buyerId !== req.user!.userId) return res.status(403).json({ error: "Only bid owner can select winner" });

    await db.update(schema.bids).set({ winnerId, winnerChannelId, status: "ended" }).where(eq(schema.bids.id, bidId));

    const allOffers = await db.select().from(schema.bidOffers).where(eq(schema.bidOffers.bidId, bidId));

    await createNotification(
      winnerId,
      "Bid Won!",
      `You won the bid for ${bid.productName}. Accept to confirm the order.`,
      "bid_won",
      null
    );
    emitToUser(winnerId, "notification:new", { type: "bid_won", bidId });

    for (const offer of allOffers) {
      if (offer.sellerId !== winnerId) {
        await createNotification(
          offer.sellerId,
          "Bid Not Selected",
          `Your offer for ${bid.productName} was not selected.`,
          "bid_rejected",
          null
        );
        emitToUser(offer.sellerId, "notification:new", { type: "bid_rejected", bidId });
      }
    }

    emitToBid(bidId, "bid:winner", { bidId, winnerId, winnerChannelId });
    return res.json({ success: true, bidId, winnerId, winnerChannelId });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/bids/:id/accept", async (req: AuthRequest, res) => {
  try {
    const bidId = req.params.id as string;
    const sellerId = req.user!.userId;
    const bidRows = await db.select().from(schema.bids).where(eq(schema.bids.id, bidId)).limit(1);
    const bid = bidRows[0];
    if (!bid) return res.status(404).json({ error: "Bid not found" });
    if (bid.winnerId !== sellerId) return res.status(403).json({ error: "Only winning seller can accept" });
    if (!bid.winnerChannelId) return res.status(400).json({ error: "No winner channel set" });

    const existingOrder = await db.select().from(schema.orders).where(eq(schema.orders.bidId, bidId)).limit(1);
    if (existingOrder[0]) {
      const [withName] = await enrichOrdersWithSellerName(existingOrder);
      return res.json({ success: true, order: { ...withName, messages: [] } });
    }

    const offers = await db.select().from(schema.bidOffers).where(
      and(eq(schema.bidOffers.bidId, bidId), eq(schema.bidOffers.sellerId, sellerId), eq(schema.bidOffers.channelId, bid.winnerChannelId))
    );
    const winningOffer = offers[0];
    if (!winningOffer) return res.status(400).json({ error: "Winning offer not found" });

    const sellerRows = await db.select().from(schema.users).where(eq(schema.users.id, sellerId)).limit(1);
    const sellerName = sellerRows[0]?.fullName ?? "Seller";

    const orderId = genId("ord");
    const orderRow = {
      id: orderId,
      bidId,
      buyerId: bid.buyerId,
      sellerId,
      sellerChannelId: bid.winnerChannelId,
      offerPrice: winningOffer.price,
      productName: bid.productName,
      quantity: bid.quantity,
      status: "pending" as const,
    };
    await db.insert(schema.orders).values(orderRow);
    const order = { ...orderRow, sellerName, messages: [] };

    await createNotification(bid.buyerId, "Order Created", `${sellerName} accepted your bid for ${bid.productName}`, "order_created", null);
    emitToUser(bid.buyerId, "notification:new", { type: "order_created", orderId });

    emitToBid(bidId, "bid:accepted", { bidId, order });
    return res.json({ success: true, order });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/bids/:id/reject", validateBody(rejectBidSchema), async (req: AuthRequest, res) => {
  try {
    const bidId = req.params.id as string;
    const { channelId, reason } = req.body;
    const sellerId = req.user!.userId;
    if (!channelId || !reason) return res.status(400).json({ error: "channelId and reason required" });
    await db.insert(schema.bidRejections).values({ bidId, sellerId, channelId, reason });
    return res.json({ success: true, bidId, sellerId, channelId, reason });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/bids/:id/end", async (req: AuthRequest, res) => {
  try {
    const bidId = req.params.id as string;
    const bid = await db.select().from(schema.bids).where(eq(schema.bids.id, bidId)).limit(1);
    if (!bid[0]) return res.status(404).json({ error: "Bid not found" });
    if (bid[0].buyerId !== req.user!.userId) {
      return res.status(403).json({ error: "Only bid owner can end bid" });
    }
    await db.update(schema.bids).set({ status: "ended" }).where(eq(schema.bids.id, bidId));
    emitToBid(bidId, "bid:ended", { bidId });
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

// --- ORDERS ---
router.get("/orders", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { page, limit, offset } = parseOffsetPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });
    const orderWhere = or(eq(schema.orders.buyerId, userId), eq(schema.orders.sellerId, userId));

    const countResult = await db.select({ count: count() }).from(schema.orders).where(orderWhere);
    const total = countResult[0]?.count ?? 0;

    const allOrders = await db.select().from(schema.orders).where(orderWhere).orderBy(desc(schema.orders.createdAt)).limit(limit).offset(offset);
    const enrichedOrders = await enrichOrdersWithSellerName(allOrders);
    const orderIds = enrichedOrders.map(o => o.id);
    let msgs: any[] = [];
    if (orderIds.length > 0) {
      msgs = await db.select().from(schema.messages).where(inArray(schema.messages.orderId, orderIds));
    }
    const enriched = enrichedOrders.map(o => ({ ...o, messages: msgs.filter(m => m.orderId === o.id) }));
    return sendListResponse(res, req, enriched, buildOffsetMeta(page, limit, total));
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/orders", async (req: AuthRequest, res) => {
  try {
    const id = genId("ord");
    const { sellerName: _sellerName, messages: _messages, ...body } = req.body;
    const newOrder = { ...body, id };
    await db.insert(schema.orders).values(newOrder);
    const sellerRows = await db.select({ fullName: schema.users.fullName }).from(schema.users).where(eq(schema.users.id, newOrder.sellerId)).limit(1);
    return res.json({ ...newOrder, sellerName: _sellerName ?? sellerRows[0]?.fullName ?? "Seller", messages: [] });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/orders/:id/messages", async (req: AuthRequest, res) => {
  try {
    const orderId = req.params.id as string;
    const order = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
    if (!order[0]) return res.status(404).json({ error: "Order not found" });
    const userId = req.user!.userId;
    if (order[0].buyerId !== userId && order[0].sellerId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const id = genId("msg");
    const { timestamp, ...restBody } = req.body;
    const newMsg = {
      ...restBody,
      id,
      orderId,
      senderId: userId,
      type: req.body.type || "text",
      metadata: req.body.metadata || {},
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    };
    await db.insert(schema.messages).values(newMsg);
    const otherId = order[0].buyerId === userId ? order[0].sellerId : order[0].buyerId;
    emitToUser(otherId, "message:new", newMsg);
    return res.json(newMsg);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.patch("/orders/:id/status", validateBody(orderStatusSchema), async (req: AuthRequest, res) => {
  try {
    const orderId = req.params.id as string;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status required" });
    const order = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
    if (!order[0]) return res.status(404).json({ error: "Order not found" });
    const userId = req.user!.userId;
    if (order[0].buyerId !== userId && order[0].sellerId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.transaction(async (tx) => {
      await tx.update(schema.orders).set({ status }).where(eq(schema.orders.id, orderId));
      await tx.insert(schema.orderStatusHistory).values({
        id: genId("osh"),
        orderId,
        status,
        note: `Updated by ${userId}`,
      });
    });
    const updated = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
    const msgs = await db.select().from(schema.messages).where(eq(schema.messages.orderId, orderId));
    const [withName] = await enrichOrdersWithSellerName(updated);
    return res.json({ ...withName, messages: msgs });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

// --- REVIEWS ---
router.get("/reviews", async (req: AuthRequest, res) => {
  try {
    const { page, limit, offset } = parseOffsetPagination(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });
    const countResult = await db.select({ count: count() }).from(schema.reviews);
    const total = countResult[0]?.count ?? 0;
    const all = await db.select().from(schema.reviews).orderBy(desc(schema.reviews.createdAt)).limit(limit).offset(offset);
    return sendListResponse(res, req, all, buildOffsetMeta(page, limit, total));
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/reviews", validateBody(createReviewSchema), async (req: AuthRequest, res) => {
  try {
    const id = genId("rev");
    const newRev = { ...req.body, id, buyerId: req.user!.userId };
    await db.insert(schema.reviews).values(newRev);
    return res.json(newRev);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

export default router;
