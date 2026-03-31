import { Server } from "socket.io";

let io: Server;

export function initSocket(server: Server): void {
  io = server;
}

export function getIo(): Server {
  if (!io) throw new Error("Socket.io not initialised");
  return io;
}
