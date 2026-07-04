import React, { createContext, useCallback, useContext, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import type { User } from "@/types";

export interface FriendUser {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  avatar?: string;
  city?: string;
  role?: string;
  relationship?: "none" | "friends" | "pending_sent" | "pending_received";
}

interface FriendsContextType {
  friends: FriendUser[];
  incoming: FriendUser[];
  outgoing: FriendUser[];
  isLoading: boolean;
  sendRequest: (contactId: string) => Promise<void>;
  acceptRequest: (requesterId: string) => Promise<void>;
  rejectRequest: (requesterId: string) => Promise<void>;
  cancelRequest: (contactId: string) => Promise<void>;
  removeFriend: (contactId: string) => Promise<void>;
  searchUsers: (q: string) => Promise<FriendUser[]>;
}

const FriendsContext = createContext<FriendsContextType | null>(null);

export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user, cacheUser } = useAuth();
  const enabled = !!user;

  const { data: friends = [], isLoading: loadingFriends } = useQuery<FriendUser[]>({
    queryKey: ["friends"],
    queryFn: () => customFetch("/api/friends"),
    enabled,
  });

  const { data: requests, isLoading: loadingRequests } = useQuery<{ incoming: FriendUser[]; outgoing: FriendUser[] }>({
    queryKey: ["friend-requests"],
    queryFn: () => customFetch("/api/friends/requests"),
    enabled,
    refetchInterval: 15000,
  });

  const isLoading = enabled && (loadingFriends || loadingRequests);

  useEffect(() => {
    friends.forEach((f) => cacheUser(f as User));
    requests?.incoming?.forEach((f) => cacheUser(f as User));
    requests?.outgoing?.forEach((f) => cacheUser(f as User));
  }, [friends, requests, cacheUser]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
  };

  const sendReqMut = useMutation({
    mutationFn: (contactId: string) =>
      customFetch("/api/friends/request", { method: "POST", body: JSON.stringify({ contactId }) }),
    onSuccess: invalidate,
  });

  const acceptMut = useMutation({
    mutationFn: (requesterId: string) =>
      customFetch("/api/friends/accept", { method: "POST", body: JSON.stringify({ requesterId }) }),
    onSuccess: invalidate,
  });

  const rejectMut = useMutation({
    mutationFn: (requesterId: string) =>
      customFetch("/api/friends/reject", { method: "POST", body: JSON.stringify({ requesterId }) }),
    onSuccess: invalidate,
  });

  const cancelMut = useMutation({
    mutationFn: (contactId: string) =>
      customFetch("/api/friends/cancel", { method: "POST", body: JSON.stringify({ contactId }) }),
    onSuccess: invalidate,
  });

  const removeMut = useMutation({
    mutationFn: (contactId: string) =>
      customFetch("/api/friends/remove", { method: "DELETE", body: JSON.stringify({ contactId }) }),
    onSuccess: invalidate,
  });

  const sendRequest = useCallback(async (contactId: string) => {
    await sendReqMut.mutateAsync(contactId);
  }, [sendReqMut]);

  const acceptRequest = useCallback(async (requesterId: string) => {
    await acceptMut.mutateAsync(requesterId);
  }, [acceptMut]);

  const rejectRequest = useCallback(async (requesterId: string) => {
    await rejectMut.mutateAsync(requesterId);
  }, [rejectMut]);

  const cancelRequest = useCallback(async (contactId: string) => {
    await cancelMut.mutateAsync(contactId);
  }, [cancelMut]);

  const removeFriend = useCallback(async (contactId: string) => {
    await removeMut.mutateAsync(contactId);
  }, [removeMut]);

  const searchUsers = useCallback(async (q: string): Promise<FriendUser[]> => {
    if (!q || q.trim().length < 2) return [];
    return customFetch(`/api/friends/search?q=${encodeURIComponent(q.trim())}`);
  }, []);

  return (
    <FriendsContext.Provider
      value={{
        friends,
        incoming: requests?.incoming ?? [],
        outgoing: requests?.outgoing ?? [],
        isLoading,
        sendRequest,
        acceptRequest,
        rejectRequest,
        cancelRequest,
        removeFriend,
        searchUsers,
      }}
    >
      {children}
    </FriendsContext.Provider>
  );
}

export function useFriends() {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error("useFriends must be used within FriendsProvider");
  return ctx;
}
