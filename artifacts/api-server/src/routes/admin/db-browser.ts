import { Router } from "express";
import { db, auditLogs } from "@workspace/db";
import * as schema from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { requireAdminAuth, requirePermission, type AdminRequest } from "../../middlewares/adminAuth";

const router = Router();
router.use(requireAdminAuth);

// Registry: maps table names to Drizzle schema + column info
interface TableInfo {
  drizzleTable: any;
  primaryKey: string | string[];
  label: string;
  columns: { name: string; type: string; nullable: boolean }[];
}

function getColumnInfo(table: any): { name: string; type: string; nullable: boolean }[] {
  const cols: { name: string; type: string; nullable: boolean }[] = [];
  const tableConfig = (table as any)[Symbol.for("drizzle:Columns")] || (table as any);
  // Iterate over table keys to extract column metadata
  for (const [key, col] of Object.entries(table)) {
    if (col && typeof col === "object" && "name" in (col as any) && "dataType" in (col as any)) {
      const c = col as any;
      cols.push({
        name: c.name,
        type: c.dataType || "text",
        nullable: !c.notNull,
      });
    }
  }
  return cols;
}

const TABLE_REGISTRY: Record<string, TableInfo> = {
  users: { drizzleTable: schema.users, primaryKey: "id", label: "Users", columns: [] },
  login_history: { drizzleTable: schema.loginHistory, primaryKey: "id", label: "Login History", columns: [] },
  user_profiles: { drizzleTable: schema.userProfiles, primaryKey: "user_id", label: "User Profiles", columns: [] },
  user_settings: { drizzleTable: schema.userSettings, primaryKey: "user_id", label: "User Settings", columns: [] },
  roles_permissions: { drizzleTable: schema.rolesPermissions, primaryKey: "role", label: "Roles & Permissions", columns: [] },
  seller_accounts: { drizzleTable: schema.sellerAccounts, primaryKey: "user_id", label: "Seller Accounts", columns: [] },
  buyer_accounts: { drizzleTable: schema.buyerAccounts, primaryKey: "user_id", label: "Buyer Accounts", columns: [] },
  channels: { drizzleTable: schema.channels, primaryKey: "id", label: "Channels", columns: [] },
  channel_followers: { drizzleTable: schema.channelFollowers, primaryKey: ["channel_id", "user_id"], label: "Channel Followers", columns: [] },
  channel_admins: { drizzleTable: schema.channelAdmins, primaryKey: ["channel_id", "user_id"], label: "Channel Admins", columns: [] },
  channel_members: { drizzleTable: schema.channelMembers, primaryKey: ["channel_id", "user_id"], label: "Channel Members", columns: [] },
  product_categories: { drizzleTable: schema.productCategories, primaryKey: "id", label: "Product Categories", columns: [] },
  products: { drizzleTable: schema.products, primaryKey: "id", label: "Products", columns: [] },
  product_images: { drizzleTable: schema.productImages, primaryKey: "id", label: "Product Images", columns: [] },
  product_variants: { drizzleTable: schema.productVariants, primaryKey: "id", label: "Product Variants", columns: [] },
  inventory: { drizzleTable: schema.inventory, primaryKey: "variant_id", label: "Inventory", columns: [] },
  wishlist: { drizzleTable: schema.wishlist, primaryKey: ["user_id", "product_id"], label: "Wishlist", columns: [] },
  cart: { drizzleTable: schema.cart, primaryKey: "id", label: "Cart", columns: [] },
  cart_items: { drizzleTable: schema.cartItems, primaryKey: "id", label: "Cart Items", columns: [] },
  bids: { drizzleTable: schema.bids, primaryKey: "id", label: "Bids", columns: [] },
  bid_offers: { drizzleTable: schema.bidOffers, primaryKey: "id", label: "Bid Offers", columns: [] },
  bid_rejections: { drizzleTable: schema.bidRejections, primaryKey: ["bid_id", "seller_id"], label: "Bid Rejections", columns: [] },
  bid_participants: { drizzleTable: schema.bidParticipants, primaryKey: ["bid_id", "user_id"], label: "Bid Participants", columns: [] },
  orders: { drizzleTable: schema.orders, primaryKey: "id", label: "Orders", columns: [] },
  order_items: { drizzleTable: schema.orderItems, primaryKey: "id", label: "Order Items", columns: [] },
  order_status_history: { drizzleTable: schema.orderStatusHistory, primaryKey: "id", label: "Order Status History", columns: [] },
  chats: { drizzleTable: schema.chats, primaryKey: "id", label: "Chats", columns: [] },
  chat_participants: { drizzleTable: schema.chatParticipants, primaryKey: ["chat_id", "user_id"], label: "Chat Participants", columns: [] },
  messages: { drizzleTable: schema.messages, primaryKey: "id", label: "Messages", columns: [] },
  chat_attachments: { drizzleTable: schema.chatAttachments, primaryKey: "id", label: "Chat Attachments", columns: [] },
  chat_reactions: { drizzleTable: schema.chatReactions, primaryKey: ["message_id", "user_id"], label: "Chat Reactions", columns: [] },
  groups: { drizzleTable: schema.groups, primaryKey: "id", label: "Groups", columns: [] },
  group_members: { drizzleTable: schema.groupMembers, primaryKey: ["group_id", "user_id"], label: "Group Members", columns: [] },
  notifications: { drizzleTable: schema.notifications, primaryKey: "id", label: "Notifications", columns: [] },
  reviews: { drizzleTable: schema.reviews, primaryKey: "id", label: "Reviews", columns: [] },
  ratings: { drizzleTable: schema.ratings, primaryKey: "id", label: "Ratings", columns: [] },
  search_history: { drizzleTable: schema.searchHistory, primaryKey: "id", label: "Search History", columns: [] },
  recently_viewed_products: { drizzleTable: schema.recentlyViewedProducts, primaryKey: ["user_id", "product_id"], label: "Recently Viewed", columns: [] },
  reports: { drizzleTable: schema.reports, primaryKey: "id", label: "Reports", columns: [] },
  blocking_users: { drizzleTable: schema.blockingUsers, primaryKey: ["blocker_id", "blocked_id"], label: "Blocked Users", columns: [] },
  friends_contacts: { drizzleTable: schema.friendsContacts, primaryKey: ["user_id", "contact_id"], label: "Friends", columns: [] },
  user_activity_logs: { drizzleTable: schema.userActivityLogs, primaryKey: "id", label: "Activity Logs", columns: [] },
  file_uploads: { drizzleTable: schema.fileUploads, primaryKey: "id", label: "File Uploads", columns: [] },
  app_configuration: { drizzleTable: schema.appConfiguration, primaryKey: "key", label: "App Configuration", columns: [] },
  audit_logs: { drizzleTable: schema.auditLogs, primaryKey: "id", label: "Audit Logs", columns: [] },
  admin_sessions: { drizzleTable: schema.adminSessions, primaryKey: "id", label: "Admin Sessions", columns: [] },
};

// List all tables with counts
router.get("/tables", requirePermission("db.view"), async (req: AdminRequest, res) => {
  try {
    const tableList = [];
    for (const [name, info] of Object.entries(TABLE_REGISTRY)) {
      try {
        const result = await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(info.drizzleTable);
        tableList.push({
          name,
          label: info.label,
          count: result[0]?.count ?? 0,
          primaryKey: info.primaryKey,
        });
      } catch {
        tableList.push({ name, label: info.label, count: 0, primaryKey: info.primaryKey });
      }
    }
    return res.json(tableList);
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to list tables" });
  }
});

// Get rows from a table with pagination, search, sort
router.get("/:table", requirePermission("db.view"), async (req: AdminRequest, res) => {
  try {
    const tableName = req.params.table as string;
    const info = TABLE_REGISTRY[tableName];
    if (!info) return res.status(404).json({ error: `Table '${tableName}' not found` });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || "";
    const sortBy = (req.query.sortBy as string) || "";
    const sortOrder = (req.query.sortOrder as string) === "asc" ? "ASC" : "DESC";

    // Count
    const countResult = await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(info.drizzleTable);
    const total = countResult[0]?.count ?? 0;

    // Build query
    let query;
    if (search) {
      // Search across text columns using raw SQL
      query = await db.execute(sql.raw(
        `SELECT * FROM "${tableName}" WHERE CAST(ROW(${tableName}.*) AS TEXT) ILIKE '%${search.replace(/'/g, "''")}%' ORDER BY ${sortBy ? `"${sortBy}" ${sortOrder}` : "1 DESC"} LIMIT ${limit} OFFSET ${offset}`
      ));
    } else if (sortBy) {
      query = await db.execute(sql.raw(
        `SELECT * FROM "${tableName}" ORDER BY "${sortBy}" ${sortOrder} LIMIT ${limit} OFFSET ${offset}`
      ));
    } else {
      query = await db.execute(sql.raw(
        `SELECT * FROM "${tableName}" ORDER BY 1 DESC LIMIT ${limit} OFFSET ${offset}`
      ));
    }

    // Get column names from the table
    const colsResult = await db.execute(sql.raw(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '${tableName}' ORDER BY ordinal_position`
    ));

    return res.json({
      table: tableName,
      label: info.label,
      primaryKey: info.primaryKey,
      columns: colsResult.rows,
      rows: query.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to query table" });
  }
});

// Get single row
router.get("/:table/:id", requirePermission("db.view"), async (req: AdminRequest, res) => {
  try {
    const tableName = req.params.table as string;
    const id = req.params.id as string;
    const info = TABLE_REGISTRY[tableName];
    if (!info) return res.status(404).json({ error: `Table '${tableName}' not found` });

    const pk = typeof info.primaryKey === "string" ? info.primaryKey : info.primaryKey[0]!;
    const result = await db.execute(sql.raw(
      `SELECT * FROM "${tableName}" WHERE "${pk}" = '${id.replace(/'/g, "''")}'`
    ));

    if (result.rows.length === 0) return res.status(404).json({ error: "Record not found" });
    return res.json(result.rows[0]);
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to get record" });
  }
});

// Create row
router.post("/:table", requirePermission("db.create"), async (req: AdminRequest, res) => {
  try {
    const tableName = req.params.table as string;
    const info = TABLE_REGISTRY[tableName];
    if (!info) return res.status(404).json({ error: `Table '${tableName}' not found` });

    const data = req.body;
    const columns = Object.keys(data).map(k => `"${k}"`).join(", ");
    const values = Object.values(data).map(v => {
      if (v === null) return "NULL";
      if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
      return `'${String(v).replace(/'/g, "''")}'`;
    }).join(", ");

    const result = await db.execute(sql.raw(
      `INSERT INTO "${tableName}" (${columns}) VALUES (${values}) RETURNING *`
    ));

    // Audit log
    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}`,
      adminId: req.admin!.userId,
      action: "db_create",
      target: `${tableName}`,
      details: data,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json(result.rows[0] ?? data);
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to create record" });
  }
});

// Update row
router.put("/:table/:id", requirePermission("db.edit"), async (req: AdminRequest, res) => {
  try {
    const tableName = req.params.table as string;
    const id = req.params.id as string;
    const info = TABLE_REGISTRY[tableName];
    if (!info) return res.status(404).json({ error: `Table '${tableName}' not found` });

    const data = req.body;
    const setClauses = Object.entries(data).map(([k, v]) => {
      if (v === null) return `"${k}" = NULL`;
      if (typeof v === "object") return `"${k}" = '${JSON.stringify(v).replace(/'/g, "''")}'`;
      return `"${k}" = '${String(v).replace(/'/g, "''")}'`;
    }).join(", ");

    const pk = typeof info.primaryKey === "string" ? info.primaryKey : info.primaryKey[0]!;
    const result = await db.execute(sql.raw(
      `UPDATE "${tableName}" SET ${setClauses} WHERE "${pk}" = '${id.replace(/'/g, "''")}' RETURNING *`
    ));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      adminId: req.admin!.userId,
      action: "db_update",
      target: `${tableName}:${id}`,
      details: data,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json(result.rows[0]);
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to update record" });
  }
});

// Delete row
router.delete("/:table/:id", requirePermission("db.delete"), async (req: AdminRequest, res) => {
  try {
    const tableName = req.params.table as string;
    const id = req.params.id as string;
    const info = TABLE_REGISTRY[tableName];
    if (!info) return res.status(404).json({ error: `Table '${tableName}' not found` });

    const pk = typeof info.primaryKey === "string" ? info.primaryKey : info.primaryKey[0]!;
    await db.execute(sql.raw(
      `DELETE FROM "${tableName}" WHERE "${pk}" = '${id.replace(/'/g, "''")}'`
    ));

    await db.insert(auditLogs).values({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      adminId: req.admin!.userId,
      action: "db_delete",
      target: `${tableName}:${id}`,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || "unknown",
      browser: req.headers["user-agent"] || "unknown",
      device: "web",
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to delete record" });
  }
});

// Export table data
router.get("/:table/export/:format", requirePermission("db.view"), async (req: AdminRequest, res) => {
  try {
    const tableName = req.params.table as string;
    const format = req.params.format as string;
    const info = TABLE_REGISTRY[tableName];
    if (!info) return res.status(404).json({ error: `Table '${tableName}' not found` });

    const result = await db.execute(sql.raw(`SELECT * FROM "${tableName}"`));
    const rows = result.rows;

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${tableName}.json"`);
      return res.json(rows);
    } else if (format === "csv") {
      if (rows.length === 0) {
        res.setHeader("Content-Type", "text/csv");
        return res.send("");
      }
      const headers = Object.keys(rows[0] as object);
      const csvRows = [headers.join(",")];
      for (const row of rows) {
        const values = headers.map(h => {
          const val = (row as any)[h];
          if (val === null || val === undefined) return "";
          const str = typeof val === "object" ? JSON.stringify(val) : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(","));
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${tableName}.csv"`);
      return res.send(csvRows.join("\n"));
    }

    return res.status(400).json({ error: "Unsupported format. Use json or csv." });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to export table" });
  }
});

export default router;
