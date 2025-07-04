import { Server as SocketIOServer, Socket } from "socket.io";
import { createWorker } from "./worker";
import { Router } from "mediasoup/node/lib/types";

let mediasoupServer: Router;

const socketIoConnection = async (io: SocketIOServer) => {
  try {
    mediasoupServer = await createWorker();
  } catch (error) {
    throw error;
  }

  io.on("connection", (socket: Socket) => {
    socket.on("message", (message) => {
      console.log(`Received message: ${message}`);
      socket.emit("message", "Hello from server");
    });
  });
};

export { socketIoConnection };
