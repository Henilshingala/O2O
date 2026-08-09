import { io, type Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";
import { UploadEmitter } from "./uploadMedia";

const TOKEN_KEY = "@o2o_token";

let socket: Socket | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let currentBaseUrl: string | null = null;
const socketConnectedListeners = new Set<(s: Socket) => void>();

export function subscribeSocketConnected(cb: (s: Socket) => void): () => void {
  socketConnectedListeners.add(cb);
  if (socket && socket.connected) {
    cb(socket);
  }
  return () => {
    socketConnectedListeners.delete(cb);
  };
}

function notifySocketConnected(s: Socket) {
  socketConnectedListeners.forEach((cb) => {
    try {
      cb(s);
    } catch (e) {
      console.warn("[SOCKET] error in listener:", e);
    }
  });
}

export async function connectSocket(baseUrl: string): Promise<Socket> {
  currentBaseUrl = baseUrl;

  // Read fresh token every time — ensures re-auth after token refresh
  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem(TOKEN_KEY);
  } catch (err) {
    // Continue without token rather than crashing
  }

  // If socket already exists and is connected with the same auth, reuse it
  if (socket && socket.connected) {
    notifySocketConnected(socket);
    return socket;
  }

  // If socket exists but disconnected, update auth and reconnect
  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  socket = io(baseUrl, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on("connect", () => {
    console.log(`[SOCKET] connected on client socketId=${socket?.id}`);
    if (socket) {
      notifySocketConnected(socket);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`[SOCKET] client disconnected reason=${reason}`);
  });

  socket.on("upload:complete", (data: { uploadId: string; url: string }) => {
    if (data?.uploadId && data?.url) {
      UploadEmitter.resolve(data.uploadId, data.url);
    }
  });

  // AppState listener: reconnect when app comes back to foreground
  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") {
          ensureSocketConnected();
        }
      }
    );
  }

  return socket;
}

/** Called when app returns to foreground — reconnects if needed. */
async function ensureSocketConnected(): Promise<void> {
  if (!currentBaseUrl) return;
  if (socket && socket.connected) return;

  // Refresh token before reconnecting
  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem(TOKEN_KEY);
  } catch (_) {}

  if (!socket) {
    await connectSocket(currentBaseUrl);
    return;
  }

  socket.auth = { token };
  socket.connect();
}

/** Update socket auth token without disconnecting (call after token refresh). */
export function updateSocketToken(token: string | null): void {
  if (socket) {
    socket.auth = { token };
  }
}

export function disconnectSocket() {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  socket?.disconnect();
  socket = null;
  currentBaseUrl = null;
}

export function getSocket(): Socket | null {
  return socket;
}
