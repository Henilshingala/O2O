import { Router } from "express";
import { db } from "@workspace/db";
import { eq, or, and, inArray, desc } from "drizzle-orm";
import * as schema from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

const genId = (prefix: string) => `${prefix}_${Date.now()}`;

// --- CHANNELS & PRODUCTS ---
router.get("/channels", async (req: AuthRequest, res) => {
  try {
    const allChannels = await db.select().from(schema.channels);
    const channelsWithDetails = await Promise.all(allChannels.map(async (c) => {
      const prods = await db.select().from(schema.products).where(eq(schema.products.channelId, c.id));
      const fols = await db.select().from(schema.channelFollowers).where(eq(schema.channelFollowers.channelId, c.id));
      return { ...c, products: prods, followers: fols.map(f => f.userId), messages: [] };
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
    const newProduct = { ...req.body, id, channelId: req.params.id as string, details: req.body.details || [] };
    await db.insert(schema.products).values(newProduct);
    return res.json(newProduct);
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
    const allMsgs = await db.select().from(schema.messages).where(inArray(schema.messages.chatId, chatIds));
    
    const enriched = myChats.map(c => ({
      ...c,
      participants: allParts.filter(p => p.chatId === c.id).map(p => p.userId),
      messages: allMsgs.filter(m => m.chatId === c.id)
    }));
    return res.json(enriched);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/chats", async (req: AuthRequest, res) => {
  try {
    const { myId, otherId } = req.body;
    const id = genId("chat");
    await db.insert(schema.chats).values({ id });
    await db.insert(schema.chatParticipants).values([{ chatId: id, userId: myId }, { chatId: id, userId: otherId }]);
    return res.json({ id, participants: [myId, otherId], messages: [] });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/chats/:id/messages", async (req: AuthRequest, res) => {
  try {
    const id = genId("msg");
    const newMsg = { ...req.body, id, chatId: req.params.id as string, senderId: req.user!.userId };
    await db.insert(schema.messages).values(newMsg);
    return res.json(newMsg);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.get("/groups", async (req: AuthRequest, res) => {
  try {
    const parts = await db.select().from(schema.groupMembers).where(eq(schema.groupMembers.userId, req.user!.userId));
    const groupIds = parts.map(p => p.groupId);
    if (groupIds.length === 0) return res.json([]);
    const myGroups = await db.select().from(schema.groups).where(inArray(schema.groups.id, groupIds));
    const allParts = await db.select().from(schema.groupMembers).where(inArray(schema.groupMembers.groupId, groupIds));
    const allMsgs = await db.select().from(schema.messages).where(inArray(schema.messages.groupId, groupIds));
    
    const enriched = myGroups.map(g => ({
      ...g,
      members: allParts.filter(p => p.groupId === g.id).map(p => p.userId),
      messages: allMsgs.filter(m => m.groupId === g.id)
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
    const newMsg = { ...req.body, id, groupId: req.params.id as string, senderId: req.user!.userId };
    await db.insert(schema.messages).values(newMsg);
    return res.json(newMsg);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

// --- BIDS ---
router.get("/bids", async (req: AuthRequest, res) => {
  try {
    const allBids = await db.select().from(schema.bids);
    const bidIds = allBids.map(b => b.id);
    let offers: any[] = [];
    let rejs: any[] = [];
    if (bidIds.length > 0) {
      offers = await db.select().from(schema.bidOffers).where(inArray(schema.bidOffers.bidId, bidIds));
      rejs = await db.select().from(schema.bidRejections).where(inArray(schema.bidRejections.bidId, bidIds));
    }
    const enriched = allBids.map(b => ({
      ...b,
      offers: offers.filter(o => o.bidId === b.id),
      rejections: rejs.filter(r => r.bidId === b.id)
    }));
    return res.json(enriched);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/bids", async (req: AuthRequest, res) => {
  try {
    const id = genId("bid");
    const newBid = { ...req.body, id, buyerId: req.user!.userId, selectedSellers: req.body.selectedSellers || [], endTime: req.body.endTime ? new Date(req.body.endTime) : new Date(Date.now() + 86400000) };
    await db.insert(schema.bids).values(newBid);
    return res.json({ ...newBid, offers: [], rejections: [] });
  } catch (error: any) { console.error("BID ERROR:", error); return res.status(500).json({ error: "Server error", detail: error.message }); }
});

router.post("/bids/:id/offers", async (req: AuthRequest, res) => {
  try {
    const id = genId("off");
    const newOffer = { ...req.body, id, bidId: req.params.id as string, sellerId: req.user!.userId };
    await db.insert(schema.bidOffers).values(newOffer);
    return res.json(newOffer);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/bids/:id/winner", async (req: AuthRequest, res) => {
  try {
    await db.update(schema.bids).set({ winnerId: req.body.winnerId, winnerChannelId: req.body.winnerChannelId, status: "ended" }).where(eq(schema.bids.id, req.params.id as string));
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

// --- ORDERS ---
router.get("/orders", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const allOrders = await db.select().from(schema.orders).where(or(eq(schema.orders.buyerId, userId), eq(schema.orders.sellerId, userId)));
    const orderIds = allOrders.map(o => o.id);
    let msgs: any[] = [];
    if (orderIds.length > 0) {
      msgs = await db.select().from(schema.messages).where(inArray(schema.messages.orderId, orderIds));
    }
    const enriched = allOrders.map(o => ({ ...o, messages: msgs.filter(m => m.orderId === o.id) }));
    return res.json(enriched);
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/orders", async (req: AuthRequest, res) => {
  try {
    const id = genId("ord");
    const newOrder = { ...req.body, id };
    await db.insert(schema.orders).values(newOrder);
    return res.json({ ...newOrder, messages: [] });
  } catch (error) { return res.status(500).json({ error: "Server error" }); }
});

router.post("/orders/:id/messages", async (req: AuthRequest, res) => {
  try {
    const id = genId("msg");
    const newMsg = { ...req.body, id, orderId: req.params.id as string, senderId: req.user!.userId };
    await db.insert(schema.messages).values(newMsg);
    return res.json(newMsg);
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
