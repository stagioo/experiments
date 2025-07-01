import * as WebSocket from "ws";

const websocketConnection = (websocket: WebSocket.Server) => {
  websocket.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", (message) => {
      console.log(`Received message: ${message}`);
    });

    ws.send("Hello from server");
  });
};

export { websocketConnection };
