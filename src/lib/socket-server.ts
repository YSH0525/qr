import type { Server } from "socket.io";

let io: Server | null = null;

export function setIO(server: Server): void {
  io = server;
}

export function getIO(): Server | null {
  return io;
}

export function emitToAdmin(event: string, data: unknown): void {
  io?.to("admin").emit(event, data);
}

export function emitToRoom(roomId: string, event: string, data: unknown): void {
  io?.to(`room:${roomId}`).emit(event, data);
}

export function emitToPayment(orderId: string, event: string, data: unknown): void {
  io?.to(`payment:${orderId}`).emit(event, data);
}
