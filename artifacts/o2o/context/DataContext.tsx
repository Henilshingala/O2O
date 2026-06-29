import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
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
  createChat: (myId: string, otherId: string) => Chat | undefined;
  sendChatMessage: (chatId: string, msg: Omit<Message, "id">) => void;

  getGroup: (id: string) => Group | undefined;
  getMyGroups: (userId: string) => Group[];
  createGroup: (g: Omit<Group, "id" | "createdAt" | "updatedAt" | "messages">) => Group | undefined;
  sendGroupMessage: (groupId: string, msg: Omit<Message, "id">) => void;

  getChannel: (id: string) => Channel | undefined;
  getMyChannels: (userId: string) => Channel[];
  getFollowedChannels: (userId: string) => Channel[];
  createChannel: (c: Omit<Channel, "id" | "createdAt" | "messages" | "followers" | "products">) => Channel | undefined;
  followChannel: (channelId: string, userId: string) => void;
  sendChannelMessage: (channelId: string, msg: Omit<Message, "id">) => void;
  createProduct: (channelId: string, p: Omit<Product, "id" | "channelId" | "views" | "wishlisted" | "createdAt">) => Product | undefined;
  repostProduct: (channelId: string, productId: string, updates: Partial<Product>) => void;
  toggleWishlist: (userId: string, product: Product, channel: Channel) => void;
  isWishlisted: (userId: string, productId: string) => boolean;
  getWishlist: (userId: string) => WishlistItem[];

  getBid: (id: string) => Bid | undefined;
  getMyBids: (userId: string) => Bid[];
  getBidsForSeller: (channelId: string) => Bid[];
  createBid: (b: Omit<Bid, "id" | "offers" | "rejections" | "createdAt">) => Bid | undefined;
  submitOffer: (bidId: string, offer: Omit<BidOffer, "id" | "timestamp">) => void;
  rejectBid: (bidId: string, rejection: { sellerId: string; channelId: string; reason: string }) => void;
  selectWinner: (bidId: string, winnerId: string, winnerChannelId: string) => void;
  endBid: (bidId: string) => void;

  getOrder: (id: string) => Order | undefined;
  getMyOrders: (userId: string, role: "buyer" | "seller") => Order[];
  createOrder: (o: Omit<Order, "id" | "messages" | "createdAt">) => Order | undefined;
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

  const { data: channels = [], isLoading: loadingChannels } = useQuery<Channel[]>({ queryKey: ["channels"], queryFn: () => fetcher("/api/data/channels") });
  const { data: chats = [], isLoading: loadingChats } = useQuery<Chat[]>({ queryKey: ["chats"], queryFn: () => fetcher("/api/data/chats") });
  const { data: groups = [], isLoading: loadingGroups } = useQuery<Group[]>({ queryKey: ["groups"], queryFn: () => fetcher("/api/data/groups") });
  const { data: bids = [], isLoading: loadingBids } = useQuery<Bid[]>({ queryKey: ["bids"], queryFn: () => fetcher("/api/data/bids") });
  const { data: orders = [], isLoading: loadingOrders } = useQuery<Order[]>({ queryKey: ["orders"], queryFn: () => fetcher("/api/data/orders") });
  const { data: reviews = [], isLoading: loadingReviews } = useQuery<Review[]>({ queryKey: ["reviews"], queryFn: () => fetcher("/api/data/reviews") });
  const { data: wishlist = [], isLoading: loadingWishlist } = useQuery<WishlistItem[]>({ queryKey: ["wishlist"], queryFn: () => fetcher("/api/data/wishlist") });

  const isLoading = loadingChannels || loadingChats || loadingGroups || loadingBids || loadingOrders || loadingReviews || loadingWishlist;

  const mutator = (url: string, method: string = "POST") => {
    return async (data: any) => {
      return await customFetch<any>(url, {
        method,
        body: JSON.stringify(data),
      });
    };
  };

  const createChannelMut = useMutation({ mutationFn: mutator("/api/data/channels"), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channels"] }) });
  const followChannelMut = useMutation({ mutationFn: (id: string) => customFetch(`/api/data/channels/${id}/follow`, { method: "POST" }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channels"] }) });
  const createProductMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => customFetch(`/api/data/channels/${id}/products`, { method: "POST", body: JSON.stringify(data) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channels"] }) });
  
  const createChatMut = useMutation({ mutationFn: mutator("/api/data/chats"), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chats"] }) });
  const sendChatMsgMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => customFetch(`/api/data/chats/${id}/messages`, { method: "POST", body: JSON.stringify(data) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chats"] }) });

  const createGroupMut = useMutation({ mutationFn: mutator("/api/data/groups"), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }) });
  const sendGroupMsgMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => customFetch(`/api/data/groups/${id}/messages`, { method: "POST", body: JSON.stringify(data) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }) });

  const createBidMut = useMutation({ mutationFn: mutator("/api/data/bids"), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bids"] }) });
  const submitOfferMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => customFetch(`/api/data/bids/${id}/offers`, { method: "POST", body: JSON.stringify(data) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bids"] }) });
  const selectWinnerMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => customFetch(`/api/data/bids/${id}/winner`, { method: "POST", body: JSON.stringify(data) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bids"] }) });

  const createOrderMut = useMutation({ mutationFn: mutator("/api/data/orders"), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }) });
  const sendOrderMsgMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => customFetch(`/api/data/orders/${id}/messages`, { method: "POST", body: JSON.stringify(data) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }) });

  const toggleWishlistMut = useMutation({ mutationFn: mutator("/api/data/wishlist"), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }) });
  const createReviewMut = useMutation({ mutationFn: mutator("/api/data/reviews"), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reviews"] }) });

  // Getters
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

  // Actions
  const createChat = useCallback((myId: string, otherId: string) => { createChatMut.mutate({ myId, otherId }); return undefined; }, [createChatMut]);
  const sendChatMessage = useCallback((chatId: string, msg: Omit<Message, "id">) => { sendChatMsgMut.mutate({ id: chatId, data: msg }); }, [sendChatMsgMut]);
  
  const createGroup = useCallback((g: Omit<Group, "id" | "createdAt" | "updatedAt" | "messages">) => { createGroupMut.mutate(g); return undefined; }, [createGroupMut]);
  const sendGroupMessage = useCallback((groupId: string, msg: Omit<Message, "id">) => { sendGroupMsgMut.mutate({ id: groupId, data: msg }); }, [sendGroupMsgMut]);

  const createChannel = useCallback((c: Omit<Channel, "id" | "createdAt" | "messages" | "followers" | "products">) => { createChannelMut.mutate(c); return undefined; }, [createChannelMut]);
  const followChannel = useCallback((channelId: string, userId: string) => { followChannelMut.mutate(channelId); }, [followChannelMut]);
  const createProduct = useCallback((channelId: string, p: Omit<Product, "id" | "channelId" | "views" | "wishlisted" | "createdAt">) => { createProductMut.mutate({ id: channelId, data: p }); return undefined; }, [createProductMut]);
  const repostProduct = useCallback((channelId: string, productId: string, updates: Partial<Product>) => { /* Not implemented on backend yet */ }, []);
  const sendChannelMessage = useCallback((channelId: string, msg: Omit<Message, "id">) => { /* Not implemented yet */ }, []);

  const toggleWishlist = useCallback((userId: string, product: Product, channel: Channel) => { toggleWishlistMut.mutate({ productId: product.id }); }, [toggleWishlistMut]);

  const createBid = useCallback((b: Omit<Bid, "id" | "offers" | "rejections" | "createdAt">) => { createBidMut.mutate(b); return undefined; }, [createBidMut]);
  const submitOffer = useCallback((bidId: string, offer: Omit<BidOffer, "id" | "timestamp">) => { submitOfferMut.mutate({ id: bidId, data: offer }); }, [submitOfferMut]);
  const rejectBid = useCallback((bidId: string, rejection: { sellerId: string; channelId: string; reason: string }) => { /* Implement on backend */ }, []);
  const selectWinner = useCallback((bidId: string, winnerId: string, winnerChannelId: string) => { selectWinnerMut.mutate({ id: bidId, data: { winnerId, winnerChannelId } }); }, [selectWinnerMut]);
  const endBid = useCallback((bidId: string) => { /* Not implemented on backend yet */ }, []);

  const createOrder = useCallback((o: Omit<Order, "id" | "messages" | "createdAt">) => { createOrderMut.mutate(o); return undefined; }, [createOrderMut]);
  const sendOrderMessage = useCallback((orderId: string, msg: Omit<Message, "id">) => { sendOrderMsgMut.mutate({ id: orderId, data: msg }); }, [sendOrderMsgMut]);
  const updateOrderStatus = useCallback((orderId: string, status: Order["status"]) => { /* Implement on backend */ }, []);

  const submitReview = useCallback((r: Omit<Review, "id" | "createdAt">) => { createReviewMut.mutate(r); }, [createReviewMut]);

  return (
    <DataContext.Provider
      value={{
        chats, groups, channels, bids, orders, reviews, wishlist, isLoading,
        getChat, getChatWithUser, createChat, sendChatMessage,
        getGroup, getMyGroups, createGroup, sendGroupMessage,
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
