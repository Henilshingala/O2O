export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  mobile: string;
  city: string;
  role: "buyer" | "seller";
  password: string;
  avatar?: string;
  createdAt: string;
}

export type MessageStatus = "sending" | "sent" | "delivered" | "failed";

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  type?: "text" | "image" | "video" | "audio" | "file" | "location" | "poll";
  metadata?: Record<string, unknown>;
  replyToId?: string;
  editedAt?: string;
  deletedAt?: string;
  status?: MessageStatus;
  chatId?: string;
  groupId?: string;
  channelId?: string;
  orderId?: string;
}

export interface ProductImage {
  id: string;
  url: string;
  isPrimary: boolean;
}

export interface Chat {
  id: string;
  participants: string[];
  messages: Message[];
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  image?: string;
  members: string[];
  createdBy: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetail {
  name: string;
  value: string;
}

export interface Product {
  id: string;
  channelId: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  images?: ProductImage[];
  videoUrl?: string;
  details: ProductDetail[];
  views: number;
  wishlisted: string[];
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  logo?: string;
  category: string;
  visibility: "public" | "private";
  ownerId: string;
  followers: string[];
  products: Product[];
  messages: Message[];
  createdAt: string;
}

export interface BidOffer {
  id: string;
  sellerId: string;
  sellerName: string;
  channelId: string;
  price: number;
  deliveryTime: string;
  message: string;
  timestamp: string;
  rating: number;
}

export interface BidRejection {
  sellerId: string;
  channelId: string;
  reason: string;
}

export interface Bid {
  id: string;
  buyerId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  budget: number;
  description: string;
  selectedSellers: string[];
  allSellers: boolean;
  status: "active" | "ended" | "cancelled";
  startTime: string;
  endTime: string;
  offers: BidOffer[];
  rejections: BidRejection[];
  winnerId?: string;
  winnerChannelId?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  bidId: string;
  buyerId: string;
  sellerId: string;
  sellerName: string;
  sellerChannelId: string;
  offerPrice: number;
  productName: string;
  quantity: number;
  status: "pending" | "confirmed" | "delivered";
  messages: Message[];
  createdAt: string;
}

export interface Review {
  id: string;
  orderId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  productName: string;
  rating: number;
  text: string;
  createdAt: string;
}

export interface WishlistItem {
  productId: string;
  channelId: string;
  channelName: string;
  productName: string;
  price: number;
  image?: string;
}
