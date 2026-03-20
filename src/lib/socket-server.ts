import type { Server } from "socket.io";

const g = globalThis as unknown as { __socketIO?: Server };

export function setIO(server: Server): void {
  g.__socketIO = server;
}

export function getIO(): Server | null {
  return g.__socketIO ?? null;
}

export function emitToAdmin(event: string, data: unknown): void {
  g.__socketIO?.to("admin").emit(event, data);
}

export function emitToRoom(roomId: string, event: string, data: unknown): void {
  g.__socketIO?.to(`room:${roomId}`).emit(event, data);
}

export function emitToPayment(orderId: string, event: string, data: unknown): void {
  g.__socketIO?.to(`payment:${orderId}`).emit(event, data);
}
