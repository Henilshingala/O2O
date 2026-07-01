import React, { createContext, useContext, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@env";
import { useAuth } from "@/context/AuthContext";
import { connectSocket, disconnectSocket } from "@/lib/socket";

const API_BASE_URL = API_URL || "https://o2o-rphb.onrender.com";

function debounce<T extends (...args: any[]) => void>(fn: T, ms = 300) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
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

      const invalidateChats = debounce(() => queryClient.invalidateQueries({ queryKey: ["chats"] }));
      const invalidateGroups = debounce(() => queryClient.invalidateQueries({ queryKey: ["groups"] }));
      const invalidateChannels = debounce(() => queryClient.invalidateQueries({ queryKey: ["channels"] }));
      const invalidateOrders = debounce(() => queryClient.invalidateQueries({ queryKey: ["orders"] }));
      const invalidateBids = debounce(() => queryClient.invalidateQueries({ queryKey: ["bids"] }));
      const invalidateNotifications = debounce(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }));

      sock.on("message:new", () => {
        invalidateChats();
        invalidateGroups();
        invalidateChannels();
        invalidateOrders();
      });
      sock.on("message:edit", invalidateChats);
      sock.on("message:delete", invalidateChats);
      sock.on("bid:offer", invalidateBids);
      sock.on("bid:ended", invalidateBids);
      sock.on("bid:winner", invalidateBids);
      sock.on("notification:new", invalidateNotifications);
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
