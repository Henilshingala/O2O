import { pgTable, text, integer, boolean, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  mobile: text("mobile").notNull().unique(),
  city: text("city").notNull(),
  role: text("role", { enum: ["buyer", "seller", "admin"] }).notNull(),
  password: text("password").notNull(),
  avatar: text("avatar"),
  isBanned: boolean("is_banned").default(false).notNull(),
  bannedAt: timestamp("banned_at"),
  bannedReason: text("banned_reason"),
  isVerifiedSeller: boolean("is_verified_seller").default(false).notNull(),
  adminRole: text("admin_role", { enum: ["super_admin", "admin", "moderator", "support"] }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const loginHistory = pgTable("login_history", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  ipAddress: text("ip_address"),
  device: text("device"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id").references(() => users.id).primaryKey(),
  bio: text("bio"),
  website: text("website"),
  socialLinks: jsonb("social_links").default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userSettings = pgTable("user_settings", {
  userId: text("user_id").references(() => users.id).primaryKey(),
  theme: text("theme").default("system").notNull(),
  notificationsEnabled: boolean("notifications_enabled").default(true).notNull(),
  privacyLevel: text("privacy_level").default("public").notNull(),
});

export const rolesPermissions = pgTable("roles_permissions", {
  role: text("role").primaryKey(),
  permissions: jsonb("permissions").default([]).notNull(), // array of permission strings
});

export const sellerAccounts = pgTable("seller_accounts", {
  userId: text("user_id").references(() => users.id).primaryKey(),
  businessName: text("business_name").notNull(),
  taxId: text("tax_id"),
  verificationStatus: text("verification_status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const buyerAccounts = pgTable("buyer_accounts", {
  userId: text("user_id").references(() => users.id).primaryKey(),
  defaultShippingAddress: text("default_shipping_address"),
  preferences: jsonb("preferences").default({}),
});

export const channels = pgTable("channels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  logo: text("logo"),
  category: text("category").notNull(),
  visibility: text("visibility", { enum: ["public", "private"] }).notNull(),
  ownerId: text("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const channelFollowers = pgTable("channel_followers", {
  channelId: text("channel_id").references(() => channels.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.channelId, t.userId] }) }));

export const channelAdmins = pgTable("channel_admins", {
  channelId: text("channel_id").references(() => channels.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.channelId, t.userId] }) }));

export const channelMembers = pgTable("channel_members", {
  channelId: text("channel_id").references(() => channels.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.channelId, t.userId] }) }));

export const productCategories = pgTable("product_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").references(() => channels.id).notNull(),
  categoryId: text("category_id").references(() => productCategories.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  image: text("image"),
  details: jsonb("details").default([]).notNull(), // Array of {name, value}
  views: integer("views").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productImages = pgTable("product_images", {
  id: text("id").primaryKey(),
  productId: text("product_id").references(() => products.id).notNull(),
  url: text("url").notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productVariants = pgTable("product_variants", {
  id: text("id").primaryKey(),
  productId: text("product_id").references(() => products.id).notNull(),
  sku: text("sku").notNull().unique(),
  attributes: jsonb("attributes").default({}).notNull(),
  priceOverride: integer("price_override"),
});

export const inventory = pgTable("inventory", {
  variantId: text("variant_id").references(() => productVariants.id).primaryKey(),
  quantity: integer("quantity").default(0).notNull(),
  location: text("location"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const wishlist = pgTable("wishlist", {
  userId: text("user_id").references(() => users.id).notNull(),
  productId: text("product_id").references(() => products.id).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.productId] }) }));

export const cart = pgTable("cart", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  status: text("status", { enum: ["active", "checked_out", "abandoned"] }).default("active").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cartItems = pgTable("cart_items", {
  id: text("id").primaryKey(),
  cartId: text("cart_id").references(() => cart.id).notNull(),
  variantId: text("variant_id").references(() => productVariants.id).notNull(),
  quantity: integer("quantity").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const bids = pgTable("bids", {
  id: text("id").primaryKey(),
  buyerId: text("buyer_id").references(() => users.id).notNull(),
  productName: text("product_name").notNull(),
  productImage: text("product_image"),
  quantity: integer("quantity").notNull(),
  budget: integer("budget").notNull(),
  description: text("description").notNull(),
  selectedSellers: jsonb("selected_sellers").default([]).notNull(), // array of channelIds
  allSellers: boolean("all_sellers").default(false).notNull(),
  status: text("status", { enum: ["active", "ended", "cancelled"] }).default("active").notNull(),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time").notNull(),
  winnerId: text("winner_id"),
  winnerChannelId: text("winner_channel_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bidOffers = pgTable("bid_offers", {
  id: text("id").primaryKey(),
  bidId: text("bid_id").references(() => bids.id).notNull(),
  sellerId: text("seller_id").references(() => users.id).notNull(),
  channelId: text("channel_id").references(() => channels.id).notNull(),
  price: integer("price").notNull(),
  deliveryTime: text("delivery_time").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const bidRejections = pgTable("bid_rejections", {
  bidId: text("bid_id").references(() => bids.id).notNull(),
  sellerId: text("seller_id").references(() => users.id).notNull(),
  channelId: text("channel_id").references(() => channels.id).notNull(),
  reason: text("reason").notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.bidId, t.sellerId] }) }));

export const bidParticipants = pgTable("bid_participants", {
  bidId: text("bid_id").references(() => bids.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  role: text("role").notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.bidId, t.userId] }) }));

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  bidId: text("bid_id").notNull(),
  buyerId: text("buyer_id").references(() => users.id).notNull(),
  sellerId: text("seller_id").references(() => users.id).notNull(),
  sellerChannelId: text("seller_channel_id").references(() => channels.id).notNull(),
  offerPrice: integer("offer_price").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  status: text("status", { enum: ["pending", "confirmed", "delivered"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").references(() => orders.id).notNull(),
  variantId: text("variant_id").references(() => productVariants.id),
  price: integer("price").notNull(),
  quantity: integer("quantity").notNull(),
});

export const orderStatusHistory = pgTable("order_status_history", {
  id: text("id").primaryKey(),
  orderId: text("order_id").references(() => orders.id).notNull(),
  status: text("status").notNull(),
  note: text("note"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const chats = pgTable("chats", {
  id: text("id").primaryKey(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chatParticipants = pgTable("chat_participants", {
  chatId: text("chat_id").references(() => chats.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.chatId, t.userId] }) }));

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").references(() => chats.id), 
  groupId: text("group_id"), 
  channelId: text("channel_id"), 
  orderId: text("order_id"), 
  senderId: text("sender_id").references(() => users.id).notNull(),
  text: text("text").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const chatAttachments = pgTable("chat_attachments", {
  id: text("id").primaryKey(),
  messageId: text("message_id").references(() => messages.id).notNull(),
  url: text("url").notNull(),
  type: text("type").notNull(),
  size: integer("size"),
});

export const chatReactions = pgTable("chat_reactions", {
  messageId: text("message_id").references(() => messages.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  reaction: text("reaction").notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.messageId, t.userId] }) }));

export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  image: text("image"),
  createdBy: text("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const groupMembers = pgTable("group_members", {
  groupId: text("group_id").references(() => groups.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.groupId, t.userId] }) }));

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  id: text("id").primaryKey(),
  orderId: text("order_id").references(() => orders.id).notNull(),
  buyerId: text("buyer_id").references(() => users.id).notNull(),
  sellerId: text("seller_id").references(() => users.id).notNull(),
  productName: text("product_name").notNull(),
  rating: integer("rating").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ratings = pgTable("ratings", {
  id: text("id").primaryKey(),
  targetType: text("target_type").notNull(), // 'product', 'channel', 'seller'
  targetId: text("target_id").notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  score: integer("score").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const searchHistory = pgTable("search_history", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  query: text("query").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const recentlyViewedProducts = pgTable("recently_viewed_products", {
  userId: text("user_id").references(() => users.id).notNull(),
  productId: text("product_id").references(() => products.id).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.productId] }) }));

export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").references(() => users.id).notNull(),
  targetType: text("target_type").notNull(), // 'user', 'product', 'channel'
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const blockingUsers = pgTable("blocking_users", {
  blockerId: text("blocker_id").references(() => users.id).notNull(),
  blockedId: text("blocked_id").references(() => users.id).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.blockerId, t.blockedId] }) }));

export const friendsContacts = pgTable("friends_contacts", {
  userId: text("user_id").references(() => users.id).notNull(),
  contactId: text("contact_id").references(() => users.id).notNull(),
  status: text("status", { enum: ["pending", "accepted", "blocked"] }).default("pending").notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.contactId] }) }));

export const userActivityLogs = pgTable("user_activity_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  details: jsonb("details").default({}),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const fileUploads = pgTable("file_uploads", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  uploaderId: text("uploader_id").references(() => users.id).notNull(),
  size: integer("size").notNull(),
  type: text("type").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const appConfiguration = pgTable("app_configuration", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  details: jsonb("details").default({}),
  ipAddress: text("ip_address"),
  browser: text("browser"),
  device: text("device"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const adminSessions = pgTable("admin_sessions", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").references(() => users.id).notNull(),
  tokenHash: text("token_hash").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});