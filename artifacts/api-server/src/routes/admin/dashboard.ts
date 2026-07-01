import { Router } from "express";
import { db } from "@workspace/db";
import * as schema from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdminAuth, requirePermission, type AdminRequest } from "../../middlewares/adminAuth";

const router = Router();
router.use(requireAdminAuth);
router.use(requirePermission("dashboard.view"));

router.get("/stats", async (req: AdminRequest, res) => {
  try {
    const tables = [
      { name: "users", table: schema.users },
      { name: "channels", table: schema.channels },
      { name: "products", table: schema.products },
      { name: "orders", table: schema.orders },
      { name: "bids", table: schema.bids },
      { name: "reviews", table: schema.reviews },
      { name: "groups", table: schema.groups },
      { name: "chats", table: schema.chats },
      { name: "notifications", table: schema.notifications },
      { name: "messages", table: schema.messages },
      { name: "reports", table: schema.reports },
      { name: "fileUploads", table: schema.fileUploads },
      { name: "auditLogs", table: schema.auditLogs },
    ];

    const counts: Record<string, number> = {};
    for (const t of tables) {
      const result = await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(t.table);
      counts[t.name] = result[0]?.count ?? 0;
    }

    // Get sellers and buyers count
    const sellerCount = await db.select({ count: sql<number>`cast(count(*) as integer)` })
      .from(schema.users).where(sql`${schema.users.role} = 'seller'`);
    const buyerCount = await db.select({ count: sql<number>`cast(count(*) as integer)` })
      .from(schema.users).where(sql`${schema.users.role} = 'buyer'`);
    const adminCount = await db.select({ count: sql<number>`cast(count(*) as integer)` })
      .from(schema.users).where(sql`${schema.users.role} = 'admin'`);
    const bannedCount = await db.select({ count: sql<number>`cast(count(*) as integer)` })
      .from(schema.users).where(sql`${schema.users.isBanned} = true`);

    // Revenue (sum of order prices)
    const revenueResult = await db.select({ total: sql<number>`coalesce(cast(sum(${schema.orders.offerPrice}) as integer), 0)` })
      .from(schema.orders);

    // Active bids
    const activeBidsResult = await db.select({ count: sql<number>`cast(count(*) as integer)` })
      .from(schema.bids).where(sql`${schema.bids.status} = 'active'`);

    return res.json({
      ...counts,
      sellers: sellerCount[0]?.count ?? 0,
      buyers: buyerCount[0]?.count ?? 0,
      admins: adminCount[0]?.count ?? 0,
      bannedUsers: bannedCount[0]?.count ?? 0,
      revenue: revenueResult[0]?.total ?? 0,
      activeBids: activeBidsResult[0]?.count ?? 0,
    });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to load dashboard stats" });
  }
});

router.get("/activity", async (req: AdminRequest, res) => {
  try {
    // Recent users
    const recentUsers = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      fullName: schema.users.fullName,
      email: schema.users.email,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    }).from(schema.users)
      .orderBy(sql`${schema.users.createdAt} desc`)
      .limit(10);

    // Recent orders
    const recentOrders = await db.select()
      .from(schema.orders)
      .orderBy(sql`${schema.orders.createdAt} desc`)
      .limit(10);

    // Recent bids
    const recentBids = await db.select()
      .from(schema.bids)
      .orderBy(sql`${schema.bids.createdAt} desc`)
      .limit(10);

    // Recent audit logs
    const recentAudit = await db.select()
      .from(schema.auditLogs)
      .orderBy(sql`${schema.auditLogs.timestamp} desc`)
      .limit(20);

    return res.json({ recentUsers, recentOrders, recentBids, recentAudit });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to load activity" });
  }
});

router.get("/charts", async (req: AdminRequest, res) => {
  try {
    // Users per day (last 30 days)
    const usersPerDay = await db.execute(sql`
      SELECT date_trunc('day', created_at) as day, count(*)::integer as count
      FROM users
      WHERE created_at > now() - interval '30 days'
      GROUP BY day ORDER BY day
    `);

    // Orders per day (last 30 days)
    const ordersPerDay = await db.execute(sql`
      SELECT date_trunc('day', created_at) as day, count(*)::integer as count
      FROM orders
      WHERE created_at > now() - interval '30 days'
      GROUP BY day ORDER BY day
    `);

    // Revenue per day
    const revenuePerDay = await db.execute(sql`
      SELECT date_trunc('day', created_at) as day, coalesce(sum(offer_price), 0)::integer as total
      FROM orders
      WHERE created_at > now() - interval '30 days'
      GROUP BY day ORDER BY day
    `);

    // Users by role
    const usersByRole = await db.execute(sql`
      SELECT role, count(*)::integer as count FROM users GROUP BY role
    `);

    // Orders by status
    const ordersByStatus = await db.execute(sql`
      SELECT status, count(*)::integer as count FROM orders GROUP BY status
    `);

    // Bids by status
    const bidsByStatus = await db.execute(sql`
      SELECT status, count(*)::integer as count FROM bids GROUP BY status
    `);

    return res.json({
      usersPerDay: usersPerDay.rows,
      ordersPerDay: ordersPerDay.rows,
      revenuePerDay: revenuePerDay.rows,
      usersByRole: usersByRole.rows,
      ordersByStatus: ordersByStatus.rows,
      bidsByStatus: bidsByStatus.rows,
    });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to load charts data" });
  }
});

export default router;
