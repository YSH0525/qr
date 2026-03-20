import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { setIO } from "./src/lib/socket-server.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port, turbopack: dev });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    addTrailingSlash: false,
    transports: ["websocket", "polling"],
  });

  setIO(io);

  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on("join:admin", () => {
      socket.join("admin");
    });

    socket.on("join:room", ({ roomId }: { roomId: string }) => {
      socket.join(`room:${roomId}`);
    });

    socket.on("join:payment", ({ orderId }: { orderId: string }) => {
      socket.join(`payment:${orderId}`);
    });

    socket.on("leave:payment", ({ orderId }: { orderId: string }) => {
      socket.leave(`payment:${orderId}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io attached`);
  });
});
