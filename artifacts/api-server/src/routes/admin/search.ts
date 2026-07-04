import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdminAuth, type AdminRequest } from "../../middlewares/adminAuth";

const router = Router();
router.use(requireAdminAuth);

// Global search across multiple tables
router.get("/", async (req: AdminRequest, res) => {
  try {
    const q = (req.query.q as string) || "";
    if (!q || q.length < 2) {
      return res.json({ users: [], products: [], orders: [], bids: [], channels: [], chats: [] });
    }

    const searchTerm = `%${q}%`;

    const usersResult = await db.execute(sql`
      SELECT id, username, full_name, email, role FROM users
      WHERE username ILIKE ${searchTerm} OR full_name ILIKE ${searchTerm} OR email ILIKE ${searchTerm}
      LIMIT 10
    `);

    const productsResult = await db.execute(sql`
      SELECT id, name, description, price FROM products
      WHERE name ILIKE ${searchTerm} OR description ILIKE ${searchTerm}
      LIMIT 10
    `);

    const ordersResult = await db.execute(sql`
      SELECT id, product_name, status, offer_price FROM orders
      WHERE product_name ILIKE ${searchTerm} OR id ILIKE ${searchTerm}
      LIMIT 10
    `);

    const bidsResult = await db.execute(sql`
      SELECT id, product_name, status, budget FROM bids
      WHERE product_name ILIKE ${searchTerm} OR id ILIKE ${searchTerm}
      LIMIT 10
    `);

    const channelsResult = await db.execute(sql`
      SELECT id, name, description, category FROM channels
      WHERE name ILIKE ${searchTerm} OR description ILIKE ${searchTerm}
      LIMIT 10
    `);

    const messagesResult = await db.execute(sql`
      SELECT id, text, sender_id, chat_id FROM messages
      WHERE text ILIKE ${searchTerm}
      LIMIT 10
    `);

    return res.json({
      users: usersResult.rows,
      products: productsResult.rows,
      orders: ordersResult.rows,
      bids: bidsResult.rows,
      channels: channelsResult.rows,
      messages: messagesResult.rows,
    });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Search failed" });
  }
});

export default router;
