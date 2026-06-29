import { Router } from "express";
import { db } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as schema from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

const genId = (prefix: string) => `${prefix}_${Date.now()}`;

// Map of schema tables for dynamic CRUD
const tables = {
  loginHistory: schema.loginHistory,
  userProfiles: schema.userProfiles,
  userSettings: schema.userSettings,
  rolesPermissions: schema.rolesPermissions,
  sellerAccounts: schema.sellerAccounts,
  buyerAccounts: schema.buyerAccounts,
  channelAdmins: schema.channelAdmins,
  channelMembers: schema.channelMembers,
  productCategories: schema.productCategories,
  productImages: schema.productImages,
  productVariants: schema.productVariants,
  inventory: schema.inventory,
  cart: schema.cart,
  cartItems: schema.cartItems,
  bidParticipants: schema.bidParticipants,
  orderItems: schema.orderItems,
  orderStatusHistory: schema.orderStatusHistory,
  chatAttachments: schema.chatAttachments,
  chatReactions: schema.chatReactions,
  ratings: schema.ratings,
  searchHistory: schema.searchHistory,
  recentlyViewedProducts: schema.recentlyViewedProducts,
  reports: schema.reports,
  blockingUsers: schema.blockingUsers,
  friendsContacts: schema.friendsContacts,
  userActivityLogs: schema.userActivityLogs,
  fileUploads: schema.fileUploads,
  appConfiguration: schema.appConfiguration,
  auditLogs: schema.auditLogs,
};

// Generic CRUD factory
for (const [key, table] of Object.entries(tables)) {
  const path = `/${key}`;

  // Read all
  router.get(path, async (req, res) => {
    try {
      const data = await db.select().from(table as any);
      res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Create
  router.post(path, async (req, res) => {
    try {
      // If table expects 'id' as primary key, auto-generate it if missing
      const payload = { ...req.body };
      // Just a simple heuristic for PK
      if (table === schema.productCategories || table === schema.cart || table === schema.cartItems || table === schema.orderItems || table === schema.orderStatusHistory || table === schema.chatAttachments || table === schema.ratings || table === schema.searchHistory || table === schema.reports || table === schema.userActivityLogs || table === schema.fileUploads || table === schema.auditLogs || table === schema.loginHistory || table === schema.productImages || table === schema.productVariants) {
        if (!payload.id) payload.id = genId(key);
      }
      await db.insert(table as any).values(payload);
      res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Since not all tables have 'id' (some have composite PKs or 'userId'), generic update/delete is risky here without knowing the PK.
  // We'll provide a generic delete based on a generic filter payload
  router.post(`${path}/delete`, async (req, res) => {
    try {
      const filterKeys = Object.keys(req.body);
      if (filterKeys.length === 0) return res.status(400).json({ error: "No filter provided" });
      
      let condition: any = undefined;
      // Very naive dynamic delete for testing purposes
      for (const f of filterKeys) {
        const col = (table as any)[f];
        if (col) {
          if (!condition) condition = eq(col, req.body[f]);
        }
      }
      if (!condition) return res.status(400).json({ error: "Invalid columns for delete" });
      
      await db.delete(table as any).where(condition);
      return res.json({ success: true });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });
}

export default router;
