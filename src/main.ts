import express from "express";
import { Server as SocketIOServer } from "socket.io";
import * as http from "http";
import { socketIoConnection } from "./lib/ws";
import cors from "cors";
import { createWorkers } from "./lib/worker";

const main = async () => {
  const app = express();

  // Enable CORS for Express
  app.use(cors());

  // Create workers when server starts
  await createWorkers();

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Error handling for the server
  server.on("error", (error) => {
    console.error("Server error:", error);
  });

  socketIoConnection(io);

  const port = 8000;
  const host = "127.0.0.1";

  server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
  });
};

export { main };
