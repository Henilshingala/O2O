import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { getSocket } from "@/lib/socket";
import type { Message } from "@/types";

type RoomType = "chat" | "group" | "channel";

interface UseRealtimeMessagesOptions {
  roomType: RoomType;
  roomId: string | undefined;
  initialMessages: Message[];
  queryKey: string[];
  onSend: (msg: Omit<Message, "id">) => Promise<Message | void>;
}

export function useRealtimeMessages({
  roomType,
  roomId,
  initialMessages,
  queryKey,
  onSend,
}: UseRealtimeMessagesOptions) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [olderMessages, setOlderMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const pendingRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    // Reset message state when switching rooms
    setMessages(initialMessages);
    setOlderMessages([]);
    setNextCursor(null);
    setLoadingMore(false);
    pendingRef.current.clear();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();
    if (!socket) {
      console.warn(`[useRealtimeMessages] No socket available for room ${roomId}`);
      return;
    }

    const joinEvent = `join:${roomType}` as "join:chat" | "join:group" | "join:channel";
    const leaveEvent = `leave:${roomType}` as "leave:chat" | "leave:group" | "leave:channel";
    console.log(`[SOCKET_JOIN] ${joinEvent} roomId=${roomId}`);
    socket.emit(joinEvent, roomId);

    const handleNew = (msg: Message) => {
      console.log(`[SOCKET_MESSAGE_RECEIVED] id=${(msg as any).id} type=${(msg as any).type} chatId=${(msg as any).chatId}`);
      const belongs =
        (roomType === "chat" && (msg as any).chatId === roomId) ||
        (roomType === "group" && (msg as any).groupId === roomId) ||
        (roomType === "channel" && (msg as any).channelId === roomId);
      if (!belongs) {
        return;
      }

      console.log(`[STATE_UPDATED] processing socket message`);
      setMessages((prev) => {
        // If the real message is already in our state (because POST resolved first)
        if (prev.some((m) => m.id === msg.id)) {
          return prev.map((m) =>
            m.id.startsWith("temp_") && pendingRef.current.get(m.id) === msg.id
              ? { ...msg, status: "delivered" as const }
              : m.id === msg.id ? { ...m, ...msg, status: "delivered" as const } : m
          );
        }

        // Check if this socket message corresponds to a placeholder we have via clientTempId
        const clientTempId = (msg.metadata as any)?.clientTempId;
        const hasPlaceholder = clientTempId && prev.some((m) => m.id === clientTempId);

        if (hasPlaceholder) {
          console.log(`[PLACEHOLDER_REMOVED] matched clientTempId=${clientTempId}`);
          console.log(`[REAL_MESSAGE_INSERTED] replacing placeholder with socket msg`);
          // Replace the exact placeholder with the real message
          return prev.map((m) =>
            m.id === clientTempId ? { ...msg, status: "delivered" as const } : m
          );
        }

        // New message (no exact placeholder match)
        const isMedia = (msg as any).type !== "text" && (msg as any).type !== "poll";
        // Do not arbitrarily remove ALL temp_ placeholders just because we received a media message.
        // We only remove a text temp_ placeholder if the text matches. 
        const filtered = isMedia 
          ? prev 
          : prev.filter((m) => !m.id.startsWith("temp_") || m.text !== msg.text);

        console.log(`[REAL_MESSAGE_INSERTED] id=${(msg as any).id}`);
        return [{ ...msg, status: "delivered" }, ...filtered];
      });

      queryClient.setQueryData<any[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((entity) => {
          const idField = roomType === "chat" ? entity.id === roomId : entity.id === roomId;
          if (!idField) return entity;
          const exists = entity.messages?.some((m: Message) => m.id === msg.id);
          if (exists) return entity;
          return { ...entity, messages: [...(entity.messages || []), msg] };
        });
      });
      console.log(`[CACHE_UPDATED] queryKey=${queryKey}`);
    };

    socket.on("message:new", handleNew);
    return () => {
      socket.off("message:new", handleNew);
      console.log(`[SOCKET_LEAVE] ${leaveEvent} roomId=${roomId}`);
      socket.emit(leaveEvent, roomId);
    };
  }, [roomId, roomType, queryClient, queryKey]);

  useEffect(() => {
    if (!roomId) {
      setNextCursor(null);
      return;
    }
    if (messages.length >= 50) {
      const sorted = [...messages, ...olderMessages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setNextCursor(sorted[0]?.id ?? null);
    } else {
      setNextCursor(null);
    }
  }, [roomId, messages.length]);

  const loadOlderMessages = useCallback(async () => {
    if (!roomId || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const endpoint =
        roomType === "chat"
          ? `/api/data/chats/${roomId}/messages?limit=50&cursor=${nextCursor}`
          : roomType === "group"
            ? `/api/data/groups/${roomId}/messages?limit=50&cursor=${nextCursor}`
            : `/api/data/channels/${roomId}/messages?limit=50&cursor=${nextCursor}`;
      const data = await customFetch<{ messages: Message[]; nextCursor: string | null }>(endpoint);
      setOlderMessages((prev) => {
        const combined = [...data.messages, ...prev];
        return combined.filter((msg, idx) => combined.findIndex((m) => m.id === msg.id) === idx);
      });
      setNextCursor(data.nextCursor);
    } catch (e) {
      console.error("Failed to load older messages:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, roomType, loadingMore, nextCursor]);

  const sendMessage = useCallback(
    async (msg: Omit<Message, "id">) => {
      const tempId = `temp_${Date.now()}`;
      const tempMsg: Message = { ...msg, id: tempId, status: "sending" };
      setMessages((prev) => [tempMsg, ...prev]);

      try {
        const saved = await onSend(msg);
        const realId = (saved && typeof saved === "object" && "id" in saved ? (saved as any).id : (typeof saved === "string" ? saved : tempId));
        pendingRef.current.set(tempId, realId);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, id: realId, status: "sent" as const } : m))
        );
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) => (m.id === realId ? { ...m, status: "delivered" as const } : m))
          );
        }, 400);
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" as const } : m))
        );
      }
    },
    [onSend]
  );

  const mergedMessages = [...messages, ...olderMessages]
    .reduce<Message[]>((acc, msg) => {
      if (!acc.some((m) => m.id === msg.id)) acc.push(msg);
      return acc;
    }, [])
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    displayMessages: [...mergedMessages].reverse(),
    sendMessage,
    loadOlderMessages,
    loadingMore,
    nextCursor,
    setMessages,
  };
}
