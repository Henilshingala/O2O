import { io, type Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "@o2o_token";

let socket: Socket | null = null;

export async function connectSocket(baseUrl: string): Promise<Socket> {
  if (socket?.connected) return socket;
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  socket = io(baseUrl, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
