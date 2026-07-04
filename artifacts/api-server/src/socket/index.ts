import { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { verifyAccessToken } from "../lib/tokens";

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
    if (!token) return next(new Error("Unauthorized"));
    const payload = verifyAccessToken(token);
    if (!payload) return next(new Error("Unauthorized"));
    (socket as Socket & { userId: string }).userId = payload.userId;
    next();
  });

  io.on("connection", (socket: Socket & { userId: string }) => {
    const userId = socket.userId;
    socket.join(`user:${userId}`);

    socket.on("join:chat", (chatId: string) => socket.join(`chat:${chatId}`));
    socket.on("leave:chat", (chatId: string) => socket.leave(`chat:${chatId}`));
    socket.on("join:group", (groupId: string) => socket.join(`group:${groupId}`));
    socket.on("leave:group", (groupId: string) => socket.leave(`group:${groupId}`));
    socket.on("join:channel", (channelId: string) => socket.join(`channel:${channelId}`));
    socket.on("leave:channel", (channelId: string) => socket.leave(`channel:${channelId}`));
    socket.on("join:bid", (bidId: string) => socket.join(`bid:${bidId}`));
    socket.on("leave:bid", (bidId: string) => socket.leave(`bid:${bidId}`));
    socket.on("typing:start", (data: { chatId: string }) => {
      socket.to(`chat:${data.chatId}`).emit("typing:start", { chatId: data.chatId, userId });
    });
    socket.on("typing:stop", (data: { chatId: string }) => {
      socket.to(`chat:${data.chatId}`).emit("typing:stop", { chatId: data.chatId, userId });
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
