import { Router } from "express";
import { db, auditLogs } from "@workspace/db";
import * as schema from "@workspace/db";
import {
  sql,
  eq,
  and,
  or,
  ilike,
  asc,
  desc,
  count,
  getTableColumns,
  type SQL,
  type AnyColumn,
} from "drizzle-orm";
import { requireAdminAuth, requirePermission, type AdminRequest } from "../../middlewares/adminAuth";
import { parseOffsetPagination, buildOffsetMeta } from "../../lib/pagination";

const router = Router();
router.use(requireAdminAuth);

interface TableInfo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  drizzleTable: any;
  primaryKey: string | string[];
  label: string;
}

const TABLE_REGISTRY: Record<string, TableInfo> = {
  users: { drizzleTable: schema.users, primaryKey: "id", label: "Users" },
  login_history: { drizzleTable: schema.loginHistory, primaryKey: "id", label: "Login History" },
  user_profiles: { drizzleTable: schema.userProfiles, primaryKey: "userId", label: "User Profiles" },
  user_settings: { drizzleTable: schema.userSettings, primaryKey: "userId", label: "User Settings" },
  roles_permissions: { drizzleTable: schema.rolesPermissions, primaryKey: "role", label: "Roles & Permissions" },
  seller_accounts: { drizzleTable: schema.sellerAccounts, primaryKey: "userId", label: "Seller Accounts" },
  buyer_accounts: { drizzleTable: schema.buyerAccounts, primaryKey: "userId", label: "Buyer Accounts" },
  channels: { drizzleTable: schema.channels, primaryKey: "id", label: "Channels" },
  channel_followers: { drizzleTable: schema.channelFollowers, primaryKey: ["channelId", "userId"], label: "Channel Followers" },
  channel_admins: { drizzleTable: schema.channelAdmins, primaryKey: ["channelId", "userId"], label: "Channel Admins" },
  channel_members: { drizzleTable: schema.channelMembers, primaryKey: ["channelId", "userId"], label: "Channel Members" },
  product_categories: { drizzleTable: schema.productCategories, primaryKey: "id", label: "Product Categories" },
  products: { drizzleTable: schema.products, primaryKey: "id", label: "Products" },
  product_images: { drizzleTable: schema.productImages, primaryKey: "id", label: "Product Images" },
  product_variants: { drizzleTable: schema.productVariants, primaryKey: "id", label: "Product Variants" },
  inventory: { drizzleTable: schema.inventory, primaryKey: "variantId", label: "Inventory" },
  wishlist: { drizzleTable: schema.wishlist, primaryKey: ["userId", "productId"], label: "Wishlist" },
  cart: { drizzleTable: schema.cart, primaryKey: "id", label: "Cart" },
  cart_items: { drizzleTable: schema.cartItems, primaryKey: "id", label: "Cart Items" },
  bids: { drizzleTable: schema.bids, primaryKey: "id", label: "Bids" },
  bid_offers: { drizzleTable: schema.bidOffers, primaryKey: "id", label: "Bid Offers" },
  bid_rejections: { drizzleTable: schema.bidRejections, primaryKey: ["bidId", "sellerId"], label: "Bid Rejections" },
  bid_participants: { drizzleTable: schema.bidParticipants, primaryKey: ["bidId", "userId"], label: "Bid Participants" },
  orders: { drizzleTable: schema.orders, primaryKey: "id", label: "Orders" },
  order_items: { drizzleTable: schema.orderItems, primaryKey: "id", label: "Order Items" },
  order_status_history: { drizzleTable: schema.orderStatusHistory, primaryKey: "id", label: "Order Status History" },
  chats: { drizzleTable: schema.chats, primaryKey: "id", label: "Chats" },
  chat_participants: { drizzleTable: schema.chatParticipants, primaryKey: ["chatId", "userId"], label: "Chat Participants" },
  messages: { drizzleTable: schema.messages, primaryKey: "id", label: "Messages" },
  chat_attachments: { drizzleTable: schema.chatAttachments, primaryKey: "id", label: "Chat Attachments" },
  chat_reactions: { drizzleTable: schema.chatReactions, primaryKey: ["messageId", "userId"], label: "Chat Reactions" },
  groups: { drizzleTable: schema.groups, primaryKey: "id", label: "Groups" },
  group_members: { drizzleTable: schema.groupMembers, primaryKey: ["groupId", "userId"], label: "Group Members" },
  notifications: { drizzleTable: schema.notifications, primaryKey: "id", label: "Notifications" },
  reviews: { drizzleTable: schema.reviews, primaryKey: "id", label: "Reviews" },
  ratings: { drizzleTable: schema.ratings, primaryKey: "id", label: "Ratings" },
  search_history: { drizzleTable: schema.searchHistory, primaryKey: "id", label: "Search History" },
  recently_viewed_products: { drizzleTable: schema.recentlyViewedProducts, primaryKey: ["userId", "productId"], label: "Recently Viewed" },
  reports: { drizzleTable: schema.reports, primaryKey: "id", label: "Reports" },
  blocking_users: { drizzleTable: schema.blockingUsers, primaryKey: ["blockerId", "blockedId"], label: "Blocked Users" },
  friends_contacts: { drizzleTable: schema.friendsContacts, primaryKey: ["userId", "contactId"], label: "Friends" },
  user_activity_logs: { drizzleTable: schema.userActivityLogs, primaryKey: "id", label: "Activity Logs" },
  file_uploads: { drizzleTable: schema.fileUploads, primaryKey: "id", label: "File Uploads" },
  app_configuration: { drizzleTable: schema.appConfiguration, primaryKey: "key", label: "App Configuration" },
  audit_logs: { drizzleTable: schema.auditLogs, primaryKey: "id", label: "Audit Logs" },
  admin_sessions: { drizzleTable: schema.adminSessions, primaryKey: "id", label: "Admin Sessions" },
};

const EXPORT_MAX_ROWS = 50_000;
const EXPORT_BATCH_SIZE = 1000;

type DrizzleTable = any;

function getColumns(table: DrizzleTable) {
  return getTableColumns(table as Parameters<typeof getTableColumns>[0]);
}

function getColumnMeta(table: DrizzleTable) {
  const cols = getColumns(table);
  return Object.entries(cols).map(([key, col]) => ({
    key,
    name: col.name,
    type: col.dataType,
    nullable: !col.notNull,
  }));
}

function resolveSortColumn(table: DrizzleTable, sortBy: string): AnyColumn | null {
  if (!sortBy) return null;
  const cols = getColumns(table);
  for (const [key, col] of Object.entries(cols)) {
    if (key === sortBy || col.name === sortBy) return col;
  }
  return null;
}

function buildSearchCondition(table: DrizzleTable, search: string): SQL | undefined {
  const trimmed = search.trim();
  if (!trimmed) return undefined;

  const cols = getColumns(table);
  const conditions: SQL[] = [];
  for (const col of Object.values(cols)) {
    if (col.dataType === "string") {
      conditions.push(ilike(col, `%${trimmed}%`));
    }
  }
  if (conditions.length === 0) return undefined;
  return or(...conditions);
}

function sanitizeRowData(table: DrizzleTable, data: Record<string, unknown>): Record<string, unknown> {
  const cols = getColumns(table);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key in cols) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function getPrimaryKeyColumn(table: DrizzleTable, info: TableInfo): AnyColumn {
  const cols = getColumns(table);
  const pkName = typeof info.primaryKey === "string" ? info.primaryKey : info.primaryKey[0]!;
  const col = cols[pkName];
  if (!col) throw new Error(`Primary key column '${pkName}' not found`);
  return col;
}

async function countRows(table: DrizzleTable, where?: SQL) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = db.select({ count: count() }).from(table as any);
  if (where) {
    query = query.where(where) as typeof query;
  }
  const result = await query;
  return result[0]?.count ?? 0;
}

async function fetchRows(
  table: DrizzleTable,
  options: { where?: SQL; orderBy?: SQL; limit: number; offset: number },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = db.select().from(table as any);
  if (options.where) query = query.where(options.where) as typeof query;
  if (options.orderBy) query = query.orderBy(options.orderBy) as typeof query;
  return query.limit(options.limit).offset(options.offset);
}

router.get("/tables", requirePermission("db.view"), async (req: AdminRequest, res) => {
  try {
    const tableList = [];
    for (const [name, info] of Object.entries(TABLE_REGISTRY)) {
      try {
        const total = await countRows(info.drizzleTable);
        tableList.push({
          name,
          label: info.label,
          count: total,
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

router.get("/:table", requirePermission("db.view"), async (req: AdminRequest, res) => {
  try {
    const tableName = req.params.table as string;
    const info = TABLE_REGISTRY[tableName];
    if (!info) return res.status(404).json({ error: `Table '${tableName}' not found` });

    const { page, limit, offset } = parseOffsetPagination(req.query as Record<string, unknown>, {
      limit: 25,
      maxLimit: 100,
    });
    const search = String(req.query.search ?? "");
    const sortBy = String(req.query.sortBy ?? "");
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

    const searchCondition = buildSearchCondition(info.drizzleTable, search);
    const sortColumn = resolveSortColumn(info.drizzleTable, sortBy);
    const orderBy = sortColumn
      ? sortOrder === "asc"
        ? asc(sortColumn)
        : desc(sortColumn)
      : desc(sql`1`);

    const total = await countRows(info.drizzleTable, searchCondition);
    const rows = await fetchRows(info.drizzleTable, {
      where: searchCondition,
      orderBy,
      limit,
      offset,
    });

    const columnMeta = getColumnMeta(info.drizzleTable);
    const pagination = buildOffsetMeta(page, limit, total);

    return res.json({
      table: tableName,
      label: info.label,
      primaryKey: info.primaryKey,
      columns: columnMeta.map((c) => ({
        column_name: c.name,
        data_type: c.type,
        is_nullable: c.nullable ? "YES" : "NO",
      })),
      rows,
      ...pagination,
      totalPages: pagination.totalPages,
    });
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to query table" });
  }
});

router.get("/:table/:id", requirePermission("db.view"), async (req: AdminRequest, res) => {
  try {
    const tableName = req.params.table as string;
    const id = req.params.id as string;
    const info = TABLE_REGISTRY[tableName];
    if (!info) return res.status(404).json({ error: `Table '${tableName}' not found` });

    const pkCol = getPrimaryKeyColumn(info.drizzleTable, info);
    const result = await db
      .select()
      .from(info.drizzleTable)
      .where(eq(pkCol, id))
      .limit(1);

    if (result.length === 0) return res.status(404).json({ error: "Record not found" });
    return res.json(result[0]);
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to get record" });
  }
});

router.post("/:table", requirePermission("db.create"), async (req: AdminRequest, res) => {
  try {
    const tableName = req.params.table as string;
    const info = TABLE_REGISTRY[tableName];
    if (!info) return res.status(404).json({ error: `Table '${tableName}' not found` });

    const data = sanitizeRowData(info.drizzleTable, req.body as Record<string, unknown>);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No valid columns provided" });
    }

    const inserted = await db.insert(info.drizzleTable).values(data).returning();
    const result = inserted as Record<string, unknown>[];

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

    return res.json(result[0] ?? data);
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to create record" });
  }
});

router.put("/:table/:id", requirePermission("db.edit"), async (req: AdminRequest, res) => {
  try {
    const tableName = req.params.table as string;
    const id = req.params.id as string;
    const info = TABLE_REGISTRY[tableName];
    if (!info) return res.status(404).json({ error: `Table '${tableName}' not found` });

    const data = sanitizeRowData(info.drizzleTable, req.body as Record<string, unknown>);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No valid columns provided" });
    }

    const pkCol = getPrimaryKeyColumn(info.drizzleTable, info);
    const result = await db
      .update(info.drizzleTable)
      .set(data)
      .where(eq(pkCol, id))
      .returning();

    if (result.length === 0) return res.status(404).json({ error: "Record not found" });

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

    return res.json(result[0]);
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to update record" });
  }
});

router.delete("/:table/:id", requirePermission("db.delete"), async (req: AdminRequest, res) => {
  try {
    const tableName = req.params.table as string;
    const id = req.params.id as string;
    const info = TABLE_REGISTRY[tableName];
    if (!info) return res.status(404).json({ error: `Table '${tableName}' not found` });

    const pkCol = getPrimaryKeyColumn(info.drizzleTable, info);
    const deleted = await db
      .delete(info.drizzleTable)
      .where(eq(pkCol, id))
      .returning();
    const result = deleted as Record<string, unknown>[];

    if (result.length === 0) return res.status(404).json({ error: "Record not found" });

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

router.get("/:table/export/:format", requirePermission("db.view"), async (req: AdminRequest, res) => {
  try {
    const tableName = req.params.table as string;
    const format = req.params.format as string;
    const info = TABLE_REGISTRY[tableName];
    if (!info) return res.status(404).json({ error: `Table '${tableName}' not found` });

    if (format !== "json" && format !== "csv") {
      return res.status(400).json({ error: "Unsupported format. Use json or csv." });
    }

    const allRows: Record<string, unknown>[] = [];
    let offset = 0;
    while (allRows.length < EXPORT_MAX_ROWS) {
      const batch = await fetchRows(info.drizzleTable, {
        limit: EXPORT_BATCH_SIZE,
        offset,
        orderBy: desc(sql`1`),
      });
      if (batch.length === 0) break;
      allRows.push(...(batch as Record<string, unknown>[]));
      offset += batch.length;
      if (batch.length < EXPORT_BATCH_SIZE) break;
    }

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${tableName}.json"`);
      return res.json(allRows);
    }

    if (allRows.length === 0) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${tableName}.csv"`);
      return res.send("");
    }

    const headers = Object.keys(allRows[0]!);
    const csvRows = [headers.join(",")];
    for (const row of allRows) {
      const values = headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        const str = typeof val === "object" ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(","));
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${tableName}.csv"`);
    return res.send(csvRows.join("\n"));
  } catch (error: unknown) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to export table" });
  }
});

export default router;
