import React, { createContext, useContext, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@env";
import { useAuth } from "@/context/AuthContext";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import type { Bid, BidOffer, Chat, Group, Channel, Message } from "@/types";

const API_BASE_URL = API_URL || "https://o2o-rphb.onrender.com";

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

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }

    let mounted = true;
    connectSocket(API_BASE_URL).then((sock) => {
      if (!mounted) return;

      const debouncedInvalidateBids = debounce(() => queryClient.invalidateQueries({ queryKey: ["bids"] }));
      const debouncedInvalidateNotifications = debounce(() =>
        queryClient.invalidateQueries({ queryKey: ["notifications"] })
      );
      const debouncedInvalidateOrders = debounce(() =>
        queryClient.invalidateQueries({ queryKey: ["orders"] })
      );

      sock.on("message:new", (msg: Message & { chatId?: string; groupId?: string; channelId?: string }) => {
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
      });

      sock.on("bid:offer", (offer: BidOffer & { bidId: string }) => {
        queryClient.setQueryData<Bid[]>(["bids"], (old) =>
          old?.map((b) => {
            if (b.id !== offer.bidId) return b;
            const exists = b.offers.find(
              (o) => o.sellerId === offer.sellerId && o.channelId === offer.channelId
            );
            const offers = exists
              ? b.offers.map((o) =>
                  o.sellerId === offer.sellerId && o.channelId === offer.channelId ? { ...o, ...offer } : o
                )
              : [...b.offers, offer];
            return { ...b, offers };
          }) ?? old
        );
      });

      sock.on("bid:ended", debouncedInvalidateBids);
      sock.on("bid:winner", debouncedInvalidateBids);
      sock.on("bid:accepted", debouncedInvalidateOrders);
      sock.on("notification:new", debouncedInvalidateNotifications);
    });

    return () => {
      mounted = false;
      disconnectSocket();
    };
  }, [user, queryClient]);

  return <SocketContext.Provider value={null}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
