import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { getSocket, subscribeSocketConnected } from "@/lib/socket";
import { UploadEmitter } from "../lib/uploadMedia";
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

  // Reset when switching rooms
  useEffect(() => {
    setMessages(initialMessages);
    setOlderMessages([]);
    setNextCursor(null);
    setLoadingMore(false);
    pendingRef.current.clear();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    const joinEvent = `join:${roomType}` as "join:chat" | "join:group" | "join:channel";
    const leaveEvent = `leave:${roomType}` as "leave:chat" | "leave:group" | "leave:channel";
    let activeSocket: any = null;

    // ── message:new ──────────────────────────────────────────────────────────
    const handleNew = (msg: Message) => {
      const belongs =
        (roomType === "chat" && (msg as any).chatId === roomId) ||
        (roomType === "group" && (msg as any).groupId === roomId) ||
        (roomType === "channel" && (msg as any).channelId === roomId);
      if (!belongs) return;

      console.log(`[SOCKET] message received on client messageId=${msg.id} chatId=${(msg as any).chatId ?? roomId}`);

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) {
          return prev.map((m) =>
            m.id === msg.id
              ? { ...m, ...msg, status: "delivered" as const }
              : m
          );
        }

        const clientTempId = (msg.metadata as any)?.clientTempId;
        const hasPlaceholder = clientTempId && prev.some((m) => m.id === clientTempId);
        if (hasPlaceholder) {
          return prev.map((m) =>
            m.id === clientTempId ? { ...msg, status: "delivered" as const } : m
          );
        }

        const isMedia = (msg as any).type !== "text" && (msg as any).type !== "poll";
        const filtered = isMedia
          ? prev
          : prev.filter((m) => !m.id.startsWith("temp_") || m.text !== msg.text);
        return [{ ...msg, status: "delivered" }, ...filtered];
      });

      queryClient.setQueryData<any[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((entity) => {
          if (entity.id !== roomId) return entity;
          const exists = entity.messages?.some((m: Message) => m.id === msg.id);
          if (exists) return entity;
          return { ...entity, messages: [...(entity.messages || []), msg] };
        });
      });
    };

    // ── message:delete ────────────────────────────────────────────────────────
    const handleDelete = (payload: { id: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.id
            ? {
                ...m,
                text: "This message was deleted.",
                type: "text" as const,
                metadata: {},
                deletedAt: new Date().toISOString(),
              }
            : m
        )
      );
    };

    // ── message:deleteForMe ───────────────────────────────────────────────────
    const handleDeleteForMe = (payload: { id: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== payload.id));
    };

    // ── message:vote (poll vote update) ───────────────────────────────────────
    const handleVote = (payload: { id: string; metadata: Record<string, unknown> }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.id ? { ...m, metadata: payload.metadata } : m
        )
      );
    };

    // ── message:read (read receipts) ──────────────────────────────────────────
    const handleRead = (payload: { messageIds: string[]; userId: string; seenAt: string }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (!payload.messageIds.includes(m.id)) return m;
          const readBy = (m.metadata?.readBy as string[] | undefined) ?? [];
          if (readBy.includes(payload.userId)) return m;
          return {
            ...m,
            status: "seen" as const,
            metadata: {
              ...m.metadata,
              readBy: [...readBy, payload.userId],
              seenAt: payload.seenAt,
            },
          };
        })
      );
    };

    const unsubscribe = subscribeSocketConnected((socket) => {
      activeSocket = socket;
      socket.emit(joinEvent, roomId);
      console.log(`[SOCKET] joined ${roomType} room=${roomId}`);

      socket.off("message:new", handleNew);
      socket.off("message:delete", handleDelete);
      socket.off("message:deleteForMe", handleDeleteForMe);
      socket.off("message:vote", handleVote);
      socket.off("message:read", handleRead);

      socket.on("message:new", handleNew);
      socket.on("message:delete", handleDelete);
      socket.on("message:deleteForMe", handleDeleteForMe);
      socket.on("message:vote", handleVote);
      socket.on("message:read", handleRead);
    });

    return () => {
      unsubscribe();
      if (activeSocket) {
        activeSocket.off("message:new", handleNew);
        activeSocket.off("message:delete", handleDelete);
        activeSocket.off("message:deleteForMe", handleDeleteForMe);
        activeSocket.off("message:vote", handleVote);
        activeSocket.off("message:read", handleRead);
        activeSocket.emit(leaveEvent, roomId);
      }
    };
  }, [roomId, roomType, queryClient, queryKey]);

  // Cursor initialisation for pagination
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
      // Failed to load older messages — silently ignore
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
        const realId =
          saved && typeof saved === "object" && "id" in saved
            ? (saved as any).id
            : tempId;
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
