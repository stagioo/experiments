import { Server as SocketIOServer, Socket } from "socket.io";
import { createWorker } from "./worker";
import { Router, Worker } from "mediasoup/node/lib/types";
import { createTransport } from "./transport";
import { Room } from "./room";
import { config } from "./config";

const AUTH_TOKEN = "demo-token";

const rooms: Map<string, Room> = new Map();
let mediasoupWorker: Worker;

const socketIoConnection = async (io: SocketIOServer) => {
  if (!mediasoupWorker) {
    mediasoupWorker = await createWorker();
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token !== AUTH_TOKEN) {
      return next(new Error("Authentication error"));
    }
    next();
  });

  io.on("connection", (socket: Socket) => {
    let currentRoom: Room | undefined;
    let peerId = socket.id;

    socket.on("createRoom", async ({ roomId }, callback) => {
      if (!rooms.has(roomId)) {
        const router = await mediasoupWorker.createRouter({
          mediaCodecs: config.mediasoup.router.mediaCodecs,
        });
        const room = new Room(roomId, router);
        rooms.set(roomId, room);
      }
      callback({ roomId });
    });

    socket.on("joinRoom", async ({ roomId, token }, callback) => {
      if (token !== AUTH_TOKEN) return callback({ error: "Invalid token" });
      let room = rooms.get(roomId);
      if (!room) {
        const router = await mediasoupWorker.createRouter({
          mediaCodecs: config.mediasoup.router.mediaCodecs,
        });
        room = new Room(roomId, router);
        rooms.set(roomId, room);
      }
      currentRoom = room;
      room.addPeer(peerId);
      callback({ joined: true });
    });

    socket.on("createWebRtcTransport", async (data, callback) => {
      if (!currentRoom) return callback({ error: "No room joined" });
      const { transport, params } = await createTransport(currentRoom.router);
      currentRoom.getPeer(peerId)?.transports.push(transport);
      callback(params);
    });

    socket.on(
      "connectWebRtcTransport",
      async ({ transportId, dtlsParameters }, callback) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        await transport.connect({ dtlsParameters });
        callback({ connected: true });
      }
    );

    socket.on(
      "produce",
      async ({ transportId, kind, rtpParameters }, callback) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        const producer = await transport.produce({ kind, rtpParameters });
        peer?.producers.push(producer);
        callback({ id: producer.id });
      }
    );

    socket.on(
      "produceData",
      async (
        { transportId, sctpStreamParameters, label, protocol },
        callback
      ) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        const dataProducer = await transport.produceData({
          sctpStreamParameters,
          label,
          protocol,
        });
        peer?.dataProducers.push(dataProducer);
        callback({ id: dataProducer.id });
      }
    );

    socket.on(
      "consume",
      async ({ transportId, producerId, rtpCapabilities }, callback) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        const producerPeer = Array.from(currentRoom.peers.values()).find((p) =>
          p.producers.some((pr) => pr.id === producerId)
        );
        const producer = producerPeer?.producers.find(
          (pr) => pr.id === producerId
        );
        if (!producer) return callback({ error: "Producer not found" });
        if (!currentRoom.router.canConsume({ producerId, rtpCapabilities })) {
          return callback({ error: "Cannot consume" });
        }
        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: false,
        });
        peer?.consumers.push(consumer);
        callback({
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          type: consumer.type,
          producerPaused: consumer.producerPaused,
        });
      }
    );

    socket.on(
      "consumeData",
      async ({ transportId, dataProducerId }, callback) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        const dataProducerPeer = Array.from(currentRoom.peers.values()).find(
          (p) => p.dataProducers.some((dp) => dp.id === dataProducerId)
        );
        const dataProducer = dataProducerPeer?.dataProducers.find(
          (dp) => dp.id === dataProducerId
        );
        if (!dataProducer) return callback({ error: "DataProducer not found" });
        const dataConsumer = await transport.consumeData({ dataProducerId });
        peer?.dataConsumers.push(dataConsumer);
        callback({
          id: dataConsumer.id,
          dataProducerId,
          sctpStreamParameters: dataConsumer.sctpStreamParameters,
          label: dataConsumer.label,
          protocol: dataConsumer.protocol,
        });
      }
    );

    socket.on("disconnect", () => {
      if (currentRoom) {
        currentRoom.removePeer(peerId);
        if (currentRoom.peers.size === 0) {
          rooms.delete(currentRoom.id);
        }
      }
    });
  });
};

export { socketIoConnection };
