import React, { createContext, useCallback, useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import type {
  Bid, BidOffer, Channel, Chat, Group, Message, Order, Product, Review, WishlistItem
} from "@/types";

interface DataContextType {
  chats: Chat[];
  groups: Group[];
  channels: Channel[];
  bids: Bid[];
  orders: Order[];
  reviews: Review[];
  wishlist: WishlistItem[];
  isLoading: boolean;

  getChat: (id: string) => Chat | undefined;
  getChatWithUser: (myId: string, otherId: string) => Chat | undefined;
  createChat: (myId: string, otherId: string) => Promise<Chat>;
  sendChatMessage: (chatId: string, msg: Omit<Message, "id">) => void;

  getGroup: (id: string) => Group | undefined;
  getMyGroups: (userId: string) => Group[];
  createGroup: (g: Omit<Group, "id" | "createdAt" | "updatedAt" | "messages">) => Promise<Group>;
  sendGroupMessage: (groupId: string, msg: Omit<Message, "id">) => void;
  updateGroup: (groupId: string, updates: Partial<Pick<Group, "name" | "description" | "image">>) => Promise<void>;

  getChannel: (id: string) => Channel | undefined;
  getMyChannels: (userId: string) => Channel[];
  getFollowedChannels: (userId: string) => Channel[];
  createChannel: (c: Omit<Channel, "id" | "createdAt" | "messages" | "followers" | "products">) => Promise<Channel>;
  followChannel: (channelId: string, userId: string) => void;
  sendChannelMessage: (channelId: string, msg: Omit<Message, "id">) => void;
  createProduct: (channelId: string, p: Omit<Product, "id" | "channelId" | "views" | "wishlisted" | "createdAt">) => Promise<Product>;
  repostProduct: (channelId: string, productId: string, updates: Partial<Product>) => Promise<Product>;
  toggleWishlist: (userId: string, product: Product, channel: Channel) => void;
  isWishlisted: (userId: string, productId: string) => boolean;
  getWishlist: (userId: string) => WishlistItem[];

  getBid: (id: string) => Bid | undefined;
  getMyBids: (userId: string) => Bid[];
  getBidsForSeller: (channelId: string) => Bid[];
  createBid: (b: Omit<Bid, "id" | "offers" | "rejections" | "createdAt">) => Promise<Bid>;
  submitOffer: (bidId: string, offer: Omit<BidOffer, "id" | "timestamp">) => void;
  rejectBid: (bidId: string, rejection: { sellerId: string; channelId: string; reason: string }) => Promise<void>;
  selectWinner: (bidId: string, winnerId: string, winnerChannelId: string) => void;
  endBid: (bidId: string) => void;

  getOrder: (id: string) => Order | undefined;
  getMyOrders: (userId: string, role: "buyer" | "seller") => Order[];
  createOrder: (o: Omit<Order, "id" | "messages" | "createdAt">) => Promise<Order>;
  sendOrderMessage: (orderId: string, msg: Omit<Message, "id">) => void;
  updateOrderStatus: (orderId: string, status: Order["status"]) => void;

  getReviews: () => Review[];
  getSellerReviews: (sellerId: string) => Review[];
  canReview: (orderId: string, buyerId: string) => boolean;
  submitReview: (review: Omit<Review, "id" | "createdAt">) => void;
}

const DataContext = createContext<DataContextType | null>(null);

const fetcher = (url: string) => customFetch<any>(url);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const enabled = !!user;

  const { data: channels = [], isLoading: loadingChannels } = useQuery<Channel[]>({ queryKey: ["channels"], queryFn: () => fetcher("/api/data/channels"), enabled });
  const { data: chats = [], isLoading: loadingChats } = useQuery<Chat[]>({ queryKey: ["chats"], queryFn: () => fetcher("/api/data/chats"), enabled });
  const { data: groups = [], isLoading: loadingGroups } = useQuery<Group[]>({ queryKey: ["groups"], queryFn: () => fetcher("/api/data/groups"), enabled });
  const { data: bids = [], isLoading: loadingBids } = useQuery<Bid[]>({ queryKey: ["bids"], queryFn: () => fetcher("/api/data/bids"), enabled });
  const { data: orders = [], isLoading: loadingOrders } = useQuery<Order[]>({ queryKey: ["orders"], queryFn: () => fetcher("/api/data/orders"), enabled });
  const { data: reviews = [], isLoading: loadingReviews } = useQuery<Review[]>({ queryKey: ["reviews"], queryFn: () => fetcher("/api/data/reviews"), enabled });
  const { data: wishlist = [], isLoading: loadingWishlist } = useQuery<WishlistItem[]>({ queryKey: ["wishlist"], queryFn: () => fetcher("/api/data/wishlist"), enabled });

  const isLoading = enabled && (loadingChannels || loadingChats || loadingGroups || loadingBids || loadingOrders || loadingReviews || loadingWishlist);

  const invalidate = {
    channels: () => queryClient.invalidateQueries({ queryKey: ["channels"] }),
    chats: () => queryClient.invalidateQueries({ queryKey: ["chats"] }),
    groups: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
    bids: () => queryClient.invalidateQueries({ queryKey: ["bids"] }),
    orders: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
    reviews: () => queryClient.invalidateQueries({ queryKey: ["reviews"] }),
    wishlist: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  };

  const getChat = useCallback((id: string) => chats.find((c) => c.id === id), [chats]);
  const getChatWithUser = useCallback((myId: string, otherId: string) => chats.find((c) => c.participants.includes(myId) && c.participants.includes(otherId)), [chats]);
  const getGroup = useCallback((id: string) => groups.find((g) => g.id === id), [groups]);
  const getMyGroups = useCallback((userId: string) => groups.filter((g) => g.members.includes(userId)), [groups]);
  const getChannel = useCallback((id: string) => channels.find((c) => c.id === id), [channels]);
  const getMyChannels = useCallback((userId: string) => channels.filter((c) => c.ownerId === userId), [channels]);
  const getFollowedChannels = useCallback((userId: string) => channels.filter((c) => c.followers.includes(userId) || c.ownerId === userId), [channels]);
  const isWishlisted = useCallback((userId: string, productId: string) => wishlist.some((w) => w.productId === productId), [wishlist]);
  const getWishlist = useCallback((userId: string) => wishlist, [wishlist]);
  const getBid = useCallback((id: string) => bids.find((b) => b.id === id), [bids]);
  const getMyBids = useCallback((userId: string) => bids.filter((b) => b.buyerId === userId), [bids]);
  const getBidsForSeller = useCallback((channelId: string) => bids.filter((b) => (b.allSellers || b.selectedSellers.includes(channelId)) && b.status === "active"), [bids]);
  const getOrder = useCallback((id: string) => orders.find((o) => o.id === id), [orders]);
  const getMyOrders = useCallback((userId: string, role: "buyer" | "seller") => role === "buyer" ? orders.filter((o) => o.buyerId === userId) : orders.filter((o) => o.sellerId === userId), [orders]);
  const getReviews = useCallback(() => reviews, [reviews]);
  const getSellerReviews = useCallback((sellerId: string) => reviews.filter(r => r.sellerId === sellerId), [reviews]);
  const canReview = useCallback((orderId: string, buyerId: string) => {
    const o = orders.find(o => o.id === orderId);
    if (!o || o.buyerId !== buyerId || o.status !== "delivered") return false;
    return !reviews.some(r => r.orderId === orderId);
  }, [orders, reviews]);

  const createChat = useCallback(async (myId: string, otherId: string): Promise<Chat> => {
    const existing = chats.find((c) => c.participants.includes(myId) && c.participants.includes(otherId));
    if (existing) return existing;
    const chat = await customFetch<Chat>("/api/data/chats", {
      method: "POST",
      body: JSON.stringify({ myId, otherId }),
    });
    invalidate.chats();
    return chat;
  }, [chats]);

  const sendChatMessage = useCallback((chatId: string, msg: Omit<Message, "id">) => {
    customFetch(`/api/data/chats/${chatId}/messages`, { method: "POST", body: JSON.stringify(msg) })
      .then(() => invalidate.chats());
  }, []);

  const createGroup = useCallback(async (g: Omit<Group, "id" | "createdAt" | "updatedAt" | "messages">): Promise<Group> => {
    const group = await customFetch<Group>("/api/data/groups", {
      method: "POST",
      body: JSON.stringify(g),
    });
    invalidate.groups();
    return group;
  }, []);

  const sendGroupMessage = useCallback((groupId: string, msg: Omit<Message, "id">) => {
    customFetch(`/api/data/groups/${groupId}/messages`, { method: "POST", body: JSON.stringify(msg) })
      .then(() => invalidate.groups());
  }, []);

  const updateGroup = useCallback(async (groupId: string, updates: Partial<Pick<Group, "name" | "description" | "image">>) => {
    await customFetch(`/api/data/groups/${groupId}`, { method: "PATCH", body: JSON.stringify(updates) });
    invalidate.groups();
  }, []);

  const createChannel = useCallback(async (c: Omit<Channel, "id" | "createdAt" | "messages" | "followers" | "products">): Promise<Channel> => {
    const channel = await customFetch<Channel>("/api/data/channels", { method: "POST", body: JSON.stringify(c) });
    invalidate.channels();
    return channel;
  }, []);

  const followChannel = useCallback((channelId: string, _userId: string) => {
    customFetch(`/api/data/channels/${channelId}/follow`, { method: "POST" }).then(() => invalidate.channels());
  }, []);

  const createProduct = useCallback(async (channelId: string, p: Omit<Product, "id" | "channelId" | "views" | "wishlisted" | "createdAt">): Promise<Product> => {
    const product = await customFetch<Product>(`/api/data/channels/${channelId}/products`, {
      method: "POST",
      body: JSON.stringify(p),
    });
    invalidate.channels();
    return product;
  }, []);

  const repostProduct = useCallback(async (channelId: string, productId: string, updates: Partial<Product>): Promise<Product> => {
    const product = await customFetch<Product>(`/api/data/channels/${channelId}/products/${productId}/repost`, {
      method: "POST",
      body: JSON.stringify(updates),
    });
    invalidate.channels();
    return product;
  }, []);

  const sendChannelMessage = useCallback((channelId: string, msg: Omit<Message, "id">) => {
    customFetch(`/api/data/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify(msg) })
      .then(() => invalidate.channels());
  }, []);

  const toggleWishlist = useCallback((_userId: string, _product: Product, _channel: Channel) => {
    customFetch("/api/data/wishlist", { method: "POST", body: JSON.stringify({ productId: _product.id }) })
      .then(() => invalidate.wishlist());
  }, []);

  const createBid = useCallback(async (b: Omit<Bid, "id" | "offers" | "rejections" | "createdAt">): Promise<Bid> => {
    const bid = await customFetch<Bid>("/api/data/bids", { method: "POST", body: JSON.stringify(b) });
    invalidate.bids();
    return bid;
  }, []);

  const submitOffer = useCallback((bidId: string, offer: Omit<BidOffer, "id" | "timestamp">) => {
    customFetch(`/api/data/bids/${bidId}/offers`, { method: "POST", body: JSON.stringify(offer) })
      .then(() => invalidate.bids());
  }, []);

  const rejectBid = useCallback(async (bidId: string, rejection: { sellerId: string; channelId: string; reason: string }) => {
    await customFetch(`/api/data/bids/${bidId}/reject`, { method: "POST", body: JSON.stringify(rejection) });
    invalidate.bids();
  }, []);

  const selectWinner = useCallback((bidId: string, winnerId: string, winnerChannelId: string) => {
    customFetch(`/api/data/bids/${bidId}/winner`, { method: "POST", body: JSON.stringify({ winnerId, winnerChannelId }) })
      .then(() => {
        invalidate.bids();
        invalidate.orders();
      });
  }, []);

  const endBid = useCallback((bidId: string) => {
    customFetch(`/api/data/bids/${bidId}/end`, { method: "POST" })
      .then(() => invalidate.bids());
  }, []);

  const createOrder = useCallback(async (o: Omit<Order, "id" | "messages" | "createdAt">): Promise<Order> => {
    const order = await customFetch<Order>("/api/data/orders", { method: "POST", body: JSON.stringify(o) });
    invalidate.orders();
    return order;
  }, []);

  const sendOrderMessage = useCallback((orderId: string, msg: Omit<Message, "id">) => {
    customFetch(`/api/data/orders/${orderId}/messages`, { method: "POST", body: JSON.stringify(msg) })
      .then(() => invalidate.orders());
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: Order["status"]) => {
    customFetch(`/api/data/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) })
      .then(() => invalidate.orders());
  }, []);

  const submitReview = useCallback((r: Omit<Review, "id" | "createdAt">) => {
    customFetch("/api/data/reviews", { method: "POST", body: JSON.stringify(r) })
      .then(() => invalidate.reviews());
  }, []);

  return (
    <DataContext.Provider
      value={{
        chats, groups, channels, bids, orders, reviews, wishlist, isLoading,
        getChat, getChatWithUser, createChat, sendChatMessage,
        getGroup, getMyGroups, createGroup, sendGroupMessage, updateGroup,
        getChannel, getMyChannels, getFollowedChannels, createChannel, followChannel, sendChannelMessage, createProduct, repostProduct, toggleWishlist, isWishlisted, getWishlist,
        getBid, getMyBids, getBidsForSeller, createBid, submitOffer, rejectBid, selectWinner, endBid,
        getOrder, getMyOrders, createOrder, sendOrderMessage, updateOrderStatus,
        getReviews, getSellerReviews, canReview, submitReview
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
