import { Router } from "express";
import { db } from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";
import * as schema from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.post("/", async (req: AuthRequest, res) => {
  try {
    const { channelIds } = req.body;
    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
      return res.json({
        activeBids: 0, totalOffers: 0, winningRate: 0, avgPrice: 0,
        lowestOffer: 0, highestOffer: 0, rating: 0, reviews: []
      });
    }

    const userId = req.user!.userId;
    
    // active bids for these channels
    const activeBids = await db.select().from(schema.bids).where(
      and(
        eq(schema.bids.status, "active"),
      )
    );
    // Since selectedSellers is jsonb, filtering exactly in PG requires raw SQL or we filter in memory for simplicity in this migration
    const relevantActiveBids = activeBids.filter(b => b.allSellers || channelIds.some(cid => (b.selectedSellers as string[]).includes(cid)));

    // total offers made by this seller across these channels
    const totalOffers = await db.select().from(schema.bidOffers).where(
      inArray(schema.bidOffers.channelId, channelIds)
    );

    const prices = totalOffers.map(o => o.price);
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const lowestOffer = prices.length > 0 ? Math.min(...prices) : 0;
    const highestOffer = prices.length > 0 ? Math.max(...prices) : 0;

    // winning rate
    const wonBids = await db.select().from(schema.bids).where(
      inArray(schema.bids.winnerChannelId, channelIds)
    );
    const winningRate = totalOffers.length > 0 ? (wonBids.length / totalOffers.length) * 100 : 0;

    // rating and reviews
    const reviews = await db.select().from(schema.reviews).where(eq(schema.reviews.sellerId, userId));
    const rating = reviews.length > 0 ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 5.0;

    return res.json({
      activeBids: relevantActiveBids.length,
      totalOffers: totalOffers.length,
      winningRate: Math.round(winningRate),
      avgPrice: Math.round(avgPrice),
      lowestOffer,
      highestOffer,
      rating: Number(rating.toFixed(1)),
      reviews
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
