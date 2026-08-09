import { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { verifyAccessToken } from "../lib/tokens.js";

export type AppSocketServer = Server;

let ioInstance: Server | null = null;

export function getIo(): Server | null {
  return ioInstance;
}

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN || "*", credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      console.warn("[SOCKET] Connection attempt rejected: Missing token");
      return next(new Error("Unauthorized"));
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      console.warn("[SOCKET] Connection attempt rejected: Invalid token");
      return next(new Error("Unauthorized"));
    }
    (socket as Socket & { userId: string }).userId = payload.userId;
    next();
  });

  io.on("connection", (socket: Socket & { userId: string }) => {
    const userId = socket.userId;
    // Every authenticated user joins their personal user room
    socket.join(`user:${userId}`);
    console.log(`[SOCKET] connected userId=${userId} socketId=${socket.id}`);

    socket.on("join:chat", (chatId: string) => {
      if (!chatId) return;
      socket.join(`chat:${chatId}`);
      console.log(`[SOCKET] joined chat room=${chatId} userId=${userId}`);
    });
    socket.on("leave:chat", (chatId: string) => {
      if (!chatId) return;
      socket.leave(`chat:${chatId}`);
      console.log(`[SOCKET] left chat room=${chatId} userId=${userId}`);
    });
    socket.on("join:group", (groupId: string) => {
      if (!groupId) return;
      socket.join(`group:${groupId}`);
      console.log(`[SOCKET] joined group room=${groupId} userId=${userId}`);
    });
    socket.on("leave:group", (groupId: string) => {
      if (!groupId) return;
      socket.leave(`group:${groupId}`);
      console.log(`[SOCKET] left group room=${groupId} userId=${userId}`);
    });
    socket.on("join:channel", (channelId: string) => {
      if (!channelId) return;
      socket.join(`channel:${channelId}`);
      console.log(`[SOCKET] joined channel room=${channelId} userId=${userId}`);
    });
    socket.on("leave:channel", (channelId: string) => {
      if (!channelId) return;
      socket.leave(`channel:${channelId}`);
      console.log(`[SOCKET] left channel room=${channelId} userId=${userId}`);
    });
    socket.on("join:bid", (bidId: string) => {
      if (!bidId) return;
      socket.join(`bid:${bidId}`);
      console.log(`[SOCKET] joined bid room=${bidId} userId=${userId}`);
    });
    socket.on("leave:bid", (bidId: string) => {
      if (!bidId) return;
      socket.leave(`bid:${bidId}`);
      console.log(`[SOCKET] left bid room=${bidId} userId=${userId}`);
    });
    socket.on("typing:start", (data: { chatId: string }) => {
      if (!data?.chatId) return;
      socket.to(`chat:${data.chatId}`).emit("typing:start", { chatId: data.chatId, userId });
    });
    socket.on("typing:stop", (data: { chatId: string }) => {
      if (!data?.chatId) return;
      socket.to(`chat:${data.chatId}`).emit("typing:stop", { chatId: data.chatId, userId });
    });
    socket.on("disconnect", (reason) => {
      console.log(`[SOCKET] disconnected userId=${userId} reason=${reason}`);
    });
  });

  ioInstance = io;
  return io;
}

export function emitToChat(chatId: string, event: string, data: unknown) {
  ioInstance?.to(`chat:${chatId}`).emit(event, data);
}

export function emitToGroup(groupId: string, event: string, data: unknown) {
  ioInstance?.to(`group:${groupId}`).emit(event, data);
}

export function emitToChannel(channelId: string, event: string, data: unknown) {
  ioInstance?.to(`channel:${channelId}`).emit(event, data);
}

export function emitToBid(bidId: string, event: string, data: unknown) {
  ioInstance?.to(`bid:${bidId}`).emit(event, data);
}

export function emitToUser(userId: string, event: string, data: unknown) {
  ioInstance?.to(`user:${userId}`).emit(event, data);
}
