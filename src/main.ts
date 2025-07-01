import express from "express";
import * as WebSocket from "ws";
import * as http from "http";
import { websocketConnection } from "./lib/ws";

const main = () => {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  websocketConnection(wss);

  const port = 3000;

  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

export { main };
