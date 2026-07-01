import { Router } from "express";
import { db } from "@workspace/db";
import { eq, or, and, inArray, desc } from "drizzle-orm";
import * as schema from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { createNotification } from "./notifications";
import { emitToChat, emitToBid, emitToUser } from "../socket/index";

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

async function loadChannelMessages(channelIds: string[]) {
  if (channelIds.length === 0) return [];
  const results = await Promise.all(
    channelIds.map(id =>
      db.select().from(schema.messages)
        .where(eq(schema.messages.channelId, id))
        .orderBy(desc(schema.messages.timestamp))
        .limit(50)
    )
  );
  return results.flat();
}

async function loadProductsWithImages(channelIds: string[]) {
  if (channelIds.length === 0) return new Map<string, Array<typeof schema.products.$inferSelect & { images: { id: string; url: string; isPrimary: boolean }[] }>>();
  const prods = await db.select().from(schema.products).where(inArray(schema.products.channelId, channelIds));
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
    const entry = { ...prod, images: prodImages };
    const list = byChannel.get(prod.channelId) ?? [];
    list.push(entry);
    byChannel.set(prod.channelId, list);
  }
  return byChannel;
}

// --- CHANNELS & PRODUCTS ---
router.get("/channels", async (req: AuthRequest, res) => {
  try {
    const allChannels = await db.select().from(schema.channels);
    const channelIds = allChannels.map((c) => c.id);
    const allChannelMsgs = await loadChannelMessages(channelIds);
    const productsByChannel = await loadProductsWithImages(channelIds);
    const fols = await db.select().from(schema.channelFollowers).where(inArray(schema.channelFollowers.channelId, channelIds));
    const channelsWithDetails = allChannels.map((c) => ({
      ...c,
      products: productsByChannel.get(c.id) ?? [],
      followers: fols.filter((f) => f.channelId === c.id).map((f) => f.userId),
      messages: allChannelMsgs.filter(m => m.channelId === c.id),
    }));
    return res.json(channelsWithDetails);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/channels", async (req: AuthRequest, res) => {
  try {
    const id = genId("ch");
    const newChannel = { ...req.body, id, ownerId: req.user!.userId };
    await db.insert(schema.channels).values(newChannel);
    return res.json({ ...newChannel, products: [], followers: [], messages: [] });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/channels/:id/products", async (req: AuthRequest, res) => {
  try {
    const id = genId("prod");
    const { images, ...body } = req.body;
    const newProduct = { ...body, id, channelId: req.params.id as string, details: body.details || [] };
    await db.insert(schema.products).values(newProduct);

    const imageUrls: string[] = Array.isArray(images) && images.length > 0
      ? images
      : newProduct.image
        ? [newProduct.image]
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
    const msgs = await db.select().from(schema.messages).where(eq(schema.messages.channelId, channelId));
    return res.json(msgs);
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
    const newMsg = { ...restBody, id, channelId, senderId: req.user!.userId, timestamp: timestamp ? new Date(timestamp) : new Date() };
    await db.insert(schema.messages).values(newMsg);
    return res.json(newMsg);
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
    const list = await db.select().from(schema.wishlist).where(eq(schema.wishlist.userId, req.user!.userId));
    return res.json(list);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/wishlist", async (req: AuthRequest, res) => {
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
    const parts = await db.select().from(schema.chatParticipants).where(eq(schema.chatParticipants.userId, req.user!.userId));
    const chatIds = parts.map(p => p.chatId);
    if (chatIds.length === 0) return res.json([]);
    const myChats = await db.select().from(schema.chats).where(inArray(schema.chats.id, chatIds));
    const allParts = await db.select().from(schema.chatParticipants).where(inArray(schema.chatParticipants.chatId, chatIds));
    
    // Fetch last 50 messages per chat concurrently
    const msgResults = await Promise.all(
      chatIds.map(id => 
        db.select().from(schema.messages)
          .where(and(eq(schema.messages.chatId, id)))
          .orderBy(desc(schema.messages.timestamp))
          .limit(50)
      )
    );
    const allMsgs = msgResults.flat();
    
    const enriched = myChats.map(c => ({
      ...c,
      participants: allParts.filter(p => p.chatId === c.id).map(p => p.userId),
      messages: allMsgs
        .filter(m => m.chatId === c.id && !m.deletedAt)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    }));
    return res.json(enriched);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/chats", async (req: AuthRequest, res) => {
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
    await db.insert(schema.chats).values({ id });
    await db.insert(schema.chatParticipants).values([{ chatId: id, userId: myId }, { chatId: id, userId: otherId }]);
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
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const cursor = req.query.cursor as string | undefined;
    const msgs = await db.select().from(schema.messages).where(eq(schema.messages.chatId, chatId));
    const filtered = msgs
      .filter((m) => !m.deletedAt)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const startIdx = cursor ? filtered.findIndex((m) => m.id === cursor) + 1 : 0;
    const page = filtered.slice(startIdx, startIdx + limit);
    const nextCursor = startIdx + limit < filtered.length ? page[page.length - 1]?.id : null;
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
    const parts = await db.select().from(schema.groupMembers).where(eq(schema.groupMembers.userId, req.user!.userId));
    const groupIds = parts.map(p => p.groupId);
    if (groupIds.length === 0) return res.json([]);
    const myGroups = await db.select().from(schema.groups).where(inArray(schema.groups.id, groupIds));
    const allParts = await db.select().from(schema.groupMembers).where(inArray(schema.groupMembers.groupId, groupIds));
    
    const msgResults = await Promise.all(
      groupIds.map(id => 
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
    return res.json(enriched);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/groups", async (req: AuthRequest, res) => {
  try {
    const id = genId("grp");
    const newGroup = { ...req.body, id, createdBy: req.user!.userId };
    await db.insert(schema.groups).values(newGroup);
    
    const members = req.body.members || [req.user!.userId];
    const memberRows = members.map((m: string) => ({ groupId: id, userId: m }));
    await db.insert(schema.groupMembers).values(memberRows);
    
    return res.json({ ...newGroup, members, messages: [] });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/groups/:id/messages", async (req: AuthRequest, res) => {
  try {
    const id = genId("msg");
    const { timestamp, ...restBody } = req.body;
    const newMsg = { ...restBody, id, groupId: req.params.id as string, senderId: req.user!.userId, timestamp: timestamp ? new Date(timestamp) : new Date() };
    await db.insert(schema.messages).values(newMsg);
    return res.json(newMsg);
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

// --- BIDS ---
router.get("/bids", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const allBids = await db.select().from(schema.bids);
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
    return res.json(enriched);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/bids", async (req: AuthRequest, res) => {
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
    const id = genId("off");
    const newOffer = { ...req.body, id, bidId: req.params.id as string, sellerId: req.user!.userId };
    await db.insert(schema.bidOffers).values(newOffer);
    emitToBid(req.params.id as string, "bid:offer", newOffer);
    const bid = await db.select().from(schema.bids).where(eq(schema.bids.id, req.params.id as string)).limit(1);
    if (bid[0]) {
      await createNotification(bid[0].buyerId, "New Bid Offer", `New offer on ${bid[0].productName}`, "bid_offer", null);
      emitToUser(bid[0].buyerId, "notification:new", { type: "bid_offer" });
    }
    return res.json(newOffer);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/bids/:id/winner", async (req: AuthRequest, res) => {
  try {
    const bidId = req.params.id as string;
    const { winnerId, winnerChannelId } = req.body;
    const bidRows = await db.select().from(schema.bids).where(eq(schema.bids.id, bidId)).limit(1);
    const bid = bidRows[0];
    if (!bid) return res.status(404).json({ error: "Bid not found" });
    if (bid.buyerId !== req.user!.userId) return res.status(403).json({ error: "Only bid owner can select winner" });

    await db.update(schema.bids).set({ winnerId, winnerChannelId, status: "ended" }).where(eq(schema.bids.id, bidId));

    const offers = await db.select().from(schema.bidOffers).where(
      and(eq(schema.bidOffers.bidId, bidId), eq(schema.bidOffers.sellerId, winnerId), eq(schema.bidOffers.channelId, winnerChannelId))
    );
    const winningOffer = offers[0];
    const sellerRows = await db.select().from(schema.users).where(eq(schema.users.id, winnerId)).limit(1);
    const sellerName = sellerRows[0]?.fullName ?? "Seller";

    let order = null;
    if (winningOffer) {
      const orderId = genId("ord");
      const orderRow = {
        id: orderId,
        bidId,
        buyerId: bid.buyerId,
        sellerId: winnerId,
        sellerChannelId: winnerChannelId,
        offerPrice: winningOffer.price,
        productName: bid.productName,
        quantity: bid.quantity,
        status: "pending" as const,
      };
      await db.insert(schema.orders).values(orderRow);
      order = { ...orderRow, sellerName, messages: [] };
      await createNotification(winnerId, "Bid Won", `You won the bid for ${bid.productName}`, "bid_won", null);
      emitToUser(winnerId, "notification:new", { type: "bid_won" });
    }

    emitToBid(bidId, "bid:winner", { bidId, winnerId, winnerChannelId, order });
    return res.json({ success: true, order });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/bids/:id/reject", async (req: AuthRequest, res) => {
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
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

// --- ORDERS ---
router.get("/orders", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const allOrders = await db.select().from(schema.orders).where(or(eq(schema.orders.buyerId, userId), eq(schema.orders.sellerId, userId)));
    const enrichedOrders = await enrichOrdersWithSellerName(allOrders);
    const orderIds = enrichedOrders.map(o => o.id);
    let msgs: any[] = [];
    if (orderIds.length > 0) {
      msgs = await db.select().from(schema.messages).where(inArray(schema.messages.orderId, orderIds));
    }
    const enriched = enrichedOrders.map(o => ({ ...o, messages: msgs.filter(m => m.orderId === o.id) }));
    return res.json(enriched);
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
    const id = genId("msg");
    const { timestamp, ...restBody } = req.body;
    const newMsg = { ...restBody, id, orderId: req.params.id as string, senderId: req.user!.userId, timestamp: timestamp ? new Date(timestamp) : new Date() };
    await db.insert(schema.messages).values(newMsg);
    return res.json(newMsg);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.patch("/orders/:id/status", async (req: AuthRequest, res) => {
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
    await db.update(schema.orders).set({ status }).where(eq(schema.orders.id, orderId));
    await db.insert(schema.orderStatusHistory).values({
      id: genId("osh"),
      orderId,
      status,
      note: `Updated by ${userId}`,
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
    const all = await db.select().from(schema.reviews);
    return res.json(all);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/reviews", async (req: AuthRequest, res) => {
  try {
    const id = genId("rev");
    const newRev = { ...req.body, id, buyerId: req.user!.userId };
    await db.insert(schema.reviews).values(newRev);
    return res.json(newRev);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

export default router;
