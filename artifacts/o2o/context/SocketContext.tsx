import React, { createContext, useContext, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { getBaseUrl } from "@workspace/api-client-react";
import type { Bid, BidOffer, Chat, Group, Channel, Message } from "@/types";

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms = 500) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

const SocketContext = createContext<null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Track registered listeners so we can remove them on cleanup without
  // disconnecting the socket (which we only do on actual logout).
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) {
      // Actual logout — tear down the socket completely.
      disconnectSocket();
      return;
    }

    let cancelled = false;
    const apiBaseUrl = getBaseUrl();

    connectSocket(apiBaseUrl).then((sock) => {
      if (cancelled) return;

      const debouncedInvalidateBids = debounce(() =>
        queryClient.invalidateQueries({ queryKey: ["bids"] })
      );
      const debouncedInvalidateNotifications = debounce(() =>
        queryClient.invalidateQueries({ queryKey: ["notifications"] })
      );
      const debouncedInvalidateOrders = debounce(() =>
        queryClient.invalidateQueries({ queryKey: ["orders"] })
      );
      const debouncedInvalidateCounts = debounce(() =>
        queryClient.invalidateQueries({ queryKey: ["counts"] })
      );
      const debouncedInvalidateFriends = debounce(() => {
        queryClient.invalidateQueries({ queryKey: ["friends"] });
        queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
        queryClient.invalidateQueries({ queryKey: ["counts"] });
      });
      const debouncedInvalidateGroups = debounce(() =>
        queryClient.invalidateQueries({ queryKey: ["groups"] })
      );
      const debouncedInvalidateChats = debounce(() =>
        queryClient.invalidateQueries({ queryKey: ["chats"] })
      );

      // ── message:new ───────────────────────────────────────────────────────
      const handleMessageNew = (msg: Message & { chatId?: string; groupId?: string; channelId?: string }) => {
        console.log(`[SOCKET] message received on client messageId=${msg.id} chatId=${msg.chatId ?? msg.groupId ?? msg.channelId}`);
        if (msg.chatId) {
          queryClient.setQueryData<Chat[]>(["chats"], (old) =>
            old?.map((c) =>
              c.id === msg.chatId && !c.messages.some((m) => m.id === msg.id)
                ? { ...c, messages: [...c.messages, msg] }
                : c
            ) ?? old
          );
        }
        if (msg.groupId) {
          queryClient.setQueryData<Group[]>(["groups"], (old) =>
            old?.map((g) =>
              g.id === msg.groupId && !g.messages.some((m) => m.id === msg.id)
                ? { ...g, messages: [...g.messages, msg] }
                : g
            ) ?? old
          );
        }
        if (msg.channelId) {
          queryClient.setQueryData<Channel[]>(["channels"], (old) =>
            old?.map((ch) =>
              ch.id === msg.channelId && !ch.messages.some((m) => m.id === msg.id)
                ? { ...ch, messages: [...ch.messages, msg] }
                : ch
            ) ?? old
          );
        }
        debouncedInvalidateCounts();
      };

      // ── message:delete ────────────────────────────────────────────────────
      const handleMessageDelete = (payload: { id: string }) => {
        const updateMessages = (messages: Message[]) =>
          messages.map((m) =>
            m.id === payload.id
              ? { ...m, text: "This message was deleted.", type: "text" as const, metadata: {}, deletedAt: new Date().toISOString() }
              : m
          );

        queryClient.setQueryData<Chat[]>(["chats"], (old) =>
          old?.map((c) => ({ ...c, messages: updateMessages(c.messages) })) ?? old
        );
        queryClient.setQueryData<Group[]>(["groups"], (old) =>
          old?.map((g) => ({ ...g, messages: updateMessages(g.messages) })) ?? old
        );
        queryClient.setQueryData<Channel[]>(["channels"], (old) =>
          old?.map((ch) => ({ ...ch, messages: updateMessages(ch.messages) })) ?? old
        );
      };

      // ── message:deleteForMe ───────────────────────────────────────────────
      const handleMessageDeleteForMe = (payload: { id: string }) => {
        const updateMessages = (messages: Message[]) =>
          messages.filter((m) => m.id !== payload.id);

        queryClient.setQueryData<Chat[]>(["chats"], (old) =>
          old?.map((c) => ({ ...c, messages: updateMessages(c.messages) })) ?? old
        );
        queryClient.setQueryData<Group[]>(["groups"], (old) =>
          old?.map((g) => ({ ...g, messages: updateMessages(g.messages) })) ?? old
        );
        queryClient.setQueryData<Channel[]>(["channels"], (old) =>
          old?.map((ch) => ({ ...ch, messages: updateMessages(ch.messages) })) ?? old
        );
      };

      // ── bid events ────────────────────────────────────────────────────────
      const handleBidOffer = (offer: BidOffer & { bidId: string }) => {
        queryClient.setQueryData<Bid[]>(["bids"], (old) =>
          old?.map((b) => {
            if (b.id !== offer.bidId) return b;
            const exists = b.offers.find(
              (o) => o.sellerId === offer.sellerId && o.channelId === offer.channelId
            );
            const offers = exists
              ? b.offers.map((o) =>
                  o.sellerId === offer.sellerId && o.channelId === offer.channelId
                    ? { ...o, ...offer }
                    : o
                )
              : [...b.offers, offer];
            return { ...b, offers };
          }) ?? old
        );
        debouncedInvalidateBids();
        debouncedInvalidateCounts();
      };

      const handleBidReceived = () => {
        debouncedInvalidateBids();
        debouncedInvalidateCounts();
      };

      const handleBidUpdated = () => {
        debouncedInvalidateBids();
        debouncedInvalidateCounts();
      };

      const handleBidEnded = () => {
        debouncedInvalidateBids();
        debouncedInvalidateCounts();
      };

      const handleBidWinner = () => {
        debouncedInvalidateBids();
        debouncedInvalidateCounts();
      };

      const handleBidAccepted = () => {
        debouncedInvalidateOrders();
        debouncedInvalidateBids();
        debouncedInvalidateCounts();
      };

      // ── notification:new ──────────────────────────────────────────────────
      const handleNotificationNew = (data?: { type?: string }) => {
        debouncedInvalidateNotifications();
        debouncedInvalidateCounts();
        // Friend events: also invalidate friends + requests
        if (
          data?.type === "friend_request" ||
          data?.type === "friend_accepted"
        ) {
          debouncedInvalidateFriends();
        }
        // Order events: also invalidate orders
        if (
          data?.type === "order_created" ||
          data?.type === "order_updated"
        ) {
          debouncedInvalidateOrders();
        }
      };

      // ── group:update ──────────────────────────────────────────────────────
      const handleGroupUpdate = () => {
        debouncedInvalidateGroups();
      };

      // ── group:deleted ─────────────────────────────────────────────────────
      const handleGroupDeleted = () => {
        debouncedInvalidateGroups();
      };

      // ── group:removed (current user was removed from a group) ─────────────
      const handleGroupRemoved = (_data: { groupId: string }) => {
        debouncedInvalidateGroups();
      };

      // ── order:update ──────────────────────────────────────────────────────
      const handleOrderUpdate = (data: { orderId: string; status: string }) => {
        queryClient.setQueryData<any[]>(["orders"], (old) =>
          old?.map((o) =>
            o.id === data.orderId ? { ...o, status: data.status } : o
          ) ?? old
        );
        debouncedInvalidateOrders();
        debouncedInvalidateCounts();
      };

      // ── chat:deleted ──────────────────────────────────────────────────────
      const handleChatDeleted = (data: { chatId: string }) => {
        queryClient.setQueryData<Chat[]>(["chats"], (old) =>
          old?.filter((c) => c.id !== data.chatId) ?? old
        );
        debouncedInvalidateChats();
      };

      // ── chat:cleared ──────────────────────────────────────────────────────
      const handleChatCleared = (data: { chatId: string }) => {
        queryClient.setQueryData<Chat[]>(["chats"], (old) =>
          old?.map((c) => c.id === data.chatId ? { ...c, messages: [] } : c) ?? old
        );
        debouncedInvalidateChats();
      };

      // ── channel:update ────────────────────────────────────────────────────
      const handleChannelUpdate = () => {
        queryClient.invalidateQueries({ queryKey: ["channels"] });
      };

      // ── product:stats:update (FEATURE 7) ─────────────────────────────────
      const handleProductStats = (data: { productId: string; wishlistCount?: number; bidCount?: number; viewCount?: number }) => {
        // Update the product inside the cached channels array
        queryClient.setQueryData<any[]>(["channels"], (old) =>
          old?.map((ch) => ({
            ...ch,
            products: ch.products?.map((p: any) =>
              p.id === data.productId
                ? {
                    ...p,
                    wishlistCount: data.wishlistCount ?? p.wishlistCount,
                    bidCount: data.bidCount ?? p.bidCount,
                    views: data.viewCount ?? p.views,
                  }
                : p
            ) ?? ch.products,
          })) ?? old
        );
      };

      // ── channel:subscriber:update (FEATURE 8) ─────────────────────────────
      const handleChannelSubscriberUpdate = (data: { channelId: string; count: number }) => {
        queryClient.setQueryData<any[]>(["channels"], (old) =>
          old?.map((ch) =>
            ch.id === data.channelId
              ? { ...ch, followers: Array.from({ length: data.count }, (_, i) => `_${i}`) }
              : ch
          ) ?? old
        );
      };

      // ── reconnect: re-sync all data when socket reconnects after a drop ────
      const handleReconnect = () => {
        queryClient.invalidateQueries({ queryKey: ["chats"] });
        queryClient.invalidateQueries({ queryKey: ["groups"] });
        queryClient.invalidateQueries({ queryKey: ["channels"] });
        queryClient.invalidateQueries({ queryKey: ["bids"] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        queryClient.invalidateQueries({ queryKey: ["counts"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: ["friends"] });
        queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      };

      sock.on("message:new", handleMessageNew);
      sock.on("message:delete", handleMessageDelete);
      sock.on("message:deleteForMe", handleMessageDeleteForMe);
      sock.on("bid:offer", handleBidOffer);
      sock.on("bid_received", handleBidReceived);
      sock.on("bid_updated", handleBidUpdated);
      sock.on("bid:ended", handleBidEnded);
      sock.on("bid:winner", handleBidWinner);
      sock.on("bid:accepted", handleBidAccepted);
      sock.on("notification:new", handleNotificationNew);
      sock.on("group:update", handleGroupUpdate);
      sock.on("group:deleted", handleGroupDeleted);
      sock.on("group:removed", handleGroupRemoved);
      sock.on("order:update", handleOrderUpdate);
      sock.on("chat:deleted", handleChatDeleted);
      sock.on("chat:cleared", handleChatCleared);
      sock.on("channel:update", handleChannelUpdate);
      sock.on("product:stats:update", handleProductStats);
      sock.on("channel:subscriber:update", handleChannelSubscriberUpdate);
      sock.on("connect", handleReconnect);

      cleanupRef.current = () => {
        sock.off("message:new", handleMessageNew);
        sock.off("message:delete", handleMessageDelete);
        sock.off("message:deleteForMe", handleMessageDeleteForMe);
        sock.off("bid:offer", handleBidOffer);
        sock.off("bid_received", handleBidReceived);
        sock.off("bid_updated", handleBidUpdated);
        sock.off("bid:ended", handleBidEnded);
        sock.off("bid:winner", handleBidWinner);
        sock.off("bid:accepted", handleBidAccepted);
        sock.off("notification:new", handleNotificationNew);
        sock.off("group:update", handleGroupUpdate);
        sock.off("group:deleted", handleGroupDeleted);
        sock.off("group:removed", handleGroupRemoved);
        sock.off("order:update", handleOrderUpdate);
        sock.off("chat:deleted", handleChatDeleted);
        sock.off("chat:cleared", handleChatCleared);
        sock.off("channel:update", handleChannelUpdate);
        sock.off("product:stats:update", handleProductStats);
        sock.off("channel:subscriber:update", handleChannelSubscriberUpdate);
        sock.off("connect", handleReconnect);
      };
    });

    return () => {
      cancelled = true;
      // Remove listeners only — do NOT disconnect; socket stays alive
      // across user context updates. Only disconnects on actual logout (user → null).
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  // Depend only on user.id — not the full user object — so a profile update
  // (avatar, username, city) does NOT tear down and re-register all socket
  // listeners, eliminating the realtime gap during profile edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, queryClient]);

  return <SocketContext.Provider value={null}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
