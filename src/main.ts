import express from "express";
import { Server as SocketIOServer } from "socket.io";
import * as http from "http";
import { socketIoConnection } from "./lib/ws";

const main = () => {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: "*" } });

  socketIoConnection(io);

  const port = 8000;

  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

export { main };
