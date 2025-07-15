import express from "express";
import { Server as SocketIOServer } from "socket.io";
import * as http from "http";
import { socketIoConnection } from "./lib/ws";
import cors from "cors";
import { Router, Worker } from "mediasoup/node/lib/types";
import { startMediasoup } from "./utils/startMediasoup";

// Refectoring
//
export async function _main() {
  let workers: {
    worker: Worker;
    router: Router;
  }[];

  try {
    workers = await startMediasoup();
  } catch (err) {
    console.log(err);
    throw err;
  }

  let workerIdx = 0;

  const getNextWorker = () => {
    const worker = workers[workerIdx];
    workerIdx++;
    workerIdx %= workers.length;
    return worker;
  };

  const createRoom = () => {
    const { worker, router } = getNextWorker();
    return { worker, router, state: {} };
  };

  // Now we should have the websoket events here for
  // differnt things join room, close peer, destroy room,
  // get track, send track, connect transpoart, so on...
}

const main = () => {
  const app = express();

  // Enable CORS for Express
  app.use(cors());

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
