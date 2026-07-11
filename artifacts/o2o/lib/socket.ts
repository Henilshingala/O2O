import { io, type Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UploadEmitter } from "./uploadMedia";

const TOKEN_KEY = "@o2o_token";

let socket: Socket | null = null;

export async function connectSocket(baseUrl: string): Promise<Socket> {
  if (socket?.connected) return socket;

  // Safely read the auth token — if AsyncStorage isn't ready or fails,
  // continue without a token rather than crashing the socket connection.
  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem(TOKEN_KEY);
  } catch (err) {
    console.warn("[socket] AsyncStorage.getItem failed, connecting without token:", err);
  }

  socket = io(baseUrl, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on("upload:complete", (data: { uploadId: string; url: string }) => {
    console.log(`[SOCKET_GLOBAL] Event=upload:complete uploadId=${data?.uploadId}`);
    if (data?.uploadId && data?.url) {
      if ((global as any).UploadEmitter) {
        (global as any).UploadEmitter.resolve(data.uploadId, data.url);
      } else {
        UploadEmitter.resolve(data.uploadId, data.url);
      }
    }
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
