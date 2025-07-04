import { Worker } from "mediasoup/node/lib/types";
import { Socket, Server as SocketIOServer } from "socket.io";
import { config } from "./config";
import db, { initDb } from "./db";
import { Room } from "./room";
import { createTransport } from "./transport";
import { createWorker } from "./worker";

const AUTH_TOKEN = "demo-token";

const rooms: Map<string, Room> = new Map();
let mediasoupWorker: Worker;

// Initialize db on server start
initDb();

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
      // Add to db if not exists
      await db.read();
      if (!db.data!.rooms.find((r) => r.id === roomId)) {
        db.data!.rooms.push({ id: roomId, users: [] });
        await db.write();
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
      // Add user to db
      await db.read();
      let dbRoom = db.data!.rooms.find((r) => r.id === roomId);
      if (dbRoom && !dbRoom.users.includes(peerId)) {
        dbRoom.users.push(peerId);
        await db.write();
      }
      if (!db.data!.users.find((u) => u.id === peerId)) {
        db.data!.users.push({ id: peerId, name: peerId });
        await db.write();
      }
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

    socket.on("getRouterRtpCapabilities", (data, callback) => {
      if (!currentRoom) return callback({ error: "No room joined" });
      callback(currentRoom.router.rtpCapabilities);
    });

    socket.on("disconnect", async () => {
      if (currentRoom) {
        currentRoom.removePeer(peerId);
        // Remove user from db room
        await db.read();
        let dbRoom = db.data!.rooms.find((r) => r.id === currentRoom!.id);
        if (dbRoom) {
          dbRoom.users = dbRoom.users.filter((u) => u !== peerId);
          await db.write();
        }
        // Remove user from db users if not in any room
        const stillInRoom = db.data!.rooms.some((r) =>
          r.users.includes(peerId)
        );
        if (!stillInRoom) {
          db.data!.users = db.data!.users.filter((u) => u.id !== peerId);
          await db.write();
        }
        // Clean up empty room
        if (currentRoom.peers.size === 0) {
          rooms.delete(currentRoom.id);
          // Remove from db
          db.data!.rooms = db.data!.rooms.filter(
            (r) => r.id !== currentRoom!.id
          );
          await db.write();
        }
      }
    });
  });
};

export { socketIoConnection };
