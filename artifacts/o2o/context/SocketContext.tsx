import React, { createContext, useContext, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@env";
import { useAuth } from "@/context/AuthContext";
import { connectSocket, disconnectSocket } from "@/lib/socket";

const API_BASE_URL = API_URL || (__DEV__ ? "http://127.0.0.1:5000" : "http://192.168.0.101:5000");

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
      sock.on("message:new", () => {
        queryClient.invalidateQueries({ queryKey: ["chats"] });
        queryClient.invalidateQueries({ queryKey: ["groups"] });
        queryClient.invalidateQueries({ queryKey: ["channels"] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      });
      sock.on("message:edit", () => queryClient.invalidateQueries({ queryKey: ["chats"] }));
      sock.on("message:delete", () => queryClient.invalidateQueries({ queryKey: ["chats"] }));
      sock.on("bid:offer", () => queryClient.invalidateQueries({ queryKey: ["bids"] }));
      sock.on("bid:ended", () => queryClient.invalidateQueries({ queryKey: ["bids"] }));
      sock.on("bid:winner", () => queryClient.invalidateQueries({ queryKey: ["bids"] }));
      sock.on("notification:new", () => queryClient.invalidateQueries({ queryKey: ["notifications"] }));
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
