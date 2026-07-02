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
    setMessages(initialMessages);
  }, [roomId, initialMessages.length]);

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();
    if (!socket) return;

    const joinEvent = `join:${roomType}` as "join:chat" | "join:group" | "join:channel";
    const leaveEvent = `leave:${roomType}` as "leave:chat" | "leave:group" | "leave:channel";
    socket.emit(joinEvent, roomId);

    const handleNew = (msg: Message) => {
      const belongs =
        (roomType === "chat" && (msg as any).chatId === roomId) ||
        (roomType === "group" && (msg as any).groupId === roomId) ||
        (roomType === "channel" && (msg as any).channelId === roomId);
      if (!belongs) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) {
          return prev.map((m) =>
            m.id.startsWith("temp_") && pendingRef.current.get(m.id) === msg.id
              ? { ...msg, status: "delivered" as const }
              : m.id === msg.id ? { ...m, ...msg, status: "delivered" as const } : m
          );
        }
        return [{ ...msg, status: "delivered" }, ...prev.filter((m) => !m.id.startsWith("temp_") || m.text !== msg.text)];
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
    };

    socket.on("message:new", handleNew);
    return () => {
      socket.off("message:new", handleNew);
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
          : `/api/data/groups/${roomId}/messages?limit=50&cursor=${nextCursor}`;
      const data = await customFetch<{ messages: Message[]; nextCursor: string | null }>(endpoint);
      setOlderMessages((prev) => {
        const combined = [...data.messages, ...prev];
        return combined.filter((msg, idx) => combined.findIndex((m) => m.id === msg.id) === idx);
      });
      setNextCursor(data.nextCursor);
    } catch (e) {
      console.error("Load older messages error", e);
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
        const realId = saved?.id ?? tempId;
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
