import * as WebSocket from "ws";
import { createWorker } from "./worker";
import { Router } from "mediasoup/node/lib/types";

let mediasoupServer: Router;

const websocketConnection = async (websocket: WebSocket.Server) => {
  try {
    mediasoupServer = await createWorker();
  } catch (error) {
    throw error;
  }

  websocket.on("connection", (ws) => {
    ws.on("message", (message) => {
      console.log(`Received message: ${message}`);
      ws.send("Hello from server");
    });
  });
};

export { websocketConnection };
