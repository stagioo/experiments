import { useCallback, useRef, useState } from "react";
import { Device } from "mediasoup-client";
import type {
  Transport,
  Consumer,
  TransportOptions,
  RtpCapabilities,
  RtpParameters,
} from "mediasoup-client/types";
import { useSocket } from "./useSocket";

export function useMediasoupClient() {
  const { socket, connected } = useSocket();
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);

  // Join or create a room
  const joinRoom = useCallback(
    async (roomId: string) => {
      if (!socket) return;
      await new Promise((resolve) => {
        socket.emit("createRoom", { roomId }, resolve);
      });
      await new Promise((resolve) => {
        socket.emit("joinRoom", { roomId, token: "demo-token" }, resolve);
      });
    },
    [socket]
  );

  // Load mediasoup device
  const loadDevice = useCallback(async (rtpCapabilities: RtpCapabilities) => {
    if (!deviceRef.current) {
      const device = new Device();
      await device.load({ routerRtpCapabilities: rtpCapabilities });
      deviceRef.current = device;
    }
    return deviceRef.current;
  }, []);

  // Create send transport
  const createSendTransport = useCallback(async () => {
    if (!socket) return;
    return new Promise<Transport>((resolve) => {
      socket.emit(
        "createWebRtcTransport",
        {},
        async (params: TransportOptions) => {
          const device = deviceRef.current;
          const transport = device!.createSendTransport(params);
          transport.on("connect", ({ dtlsParameters }, cb, errCb) => {
            socket.emit(
              "connectWebRtcTransport",
              { transportId: transport.id, dtlsParameters },
              (res: { connected: boolean }) => {
                if (res.connected) cb();
                else errCb(new Error("Failed to connect transport"));
              }
            );
          });
          transport.on("produce", ({ kind, rtpParameters }, cb, errCb) => {
            socket.emit(
              "produce",
              { transportId: transport.id, kind, rtpParameters },
              (res: { id?: string }) => {
                if (res.id) cb({ id: res.id });
                else errCb(new Error("Failed to produce media"));
              }
            );
          });
          sendTransportRef.current = transport;
          resolve(transport);
        }
      );
    });
  }, [socket]);

  // Create receive transport
  const createRecvTransport = useCallback(async () => {
    if (!socket) return;
    return new Promise<Transport>((resolve) => {
      socket.emit(
        "createWebRtcTransport",
        {},
        async (params: TransportOptions) => {
          const device = deviceRef.current;
          const transport = device!.createRecvTransport(params);
          transport.on("connect", ({ dtlsParameters }, cb, errCb) => {
            socket.emit(
              "connectWebRtcTransport",
              { transportId: transport.id, dtlsParameters },
              (res: { connected: boolean }) => {
                if (res.connected) cb();
                else errCb(new Error("Failed to connect transport"));
              }
            );
          });
          recvTransportRef.current = transport;
          resolve(transport);
        }
      );
    });
  }, [socket]);

  // Produce local media
  const produce = useCallback(async () => {
    if (!sendTransportRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    setLocalStream(stream);
    for (const track of stream.getTracks()) {
      await sendTransportRef.current.produce({ track });
    }
  }, []);

  // Consume remote media
  const consume = useCallback(
    async (producerId: string, rtpCapabilities: RtpCapabilities) => {
      if (!socket || !recvTransportRef.current) return;
      console.log({
        transportId: recvTransportRef.current.id,
        producerId,
        rtpCapabilities,
      });
      socket.emit(
        "consume",
        {
          transportId: recvTransportRef.current.id,
          producerId,
          rtpCapabilities,
        },
        async (res: {
          id: string;
          producerId: string;
          kind: string;
          rtpParameters: unknown;
        }) => {
          if (res && res.rtpParameters) {
            const consumer: Consumer = await recvTransportRef.current!.consume({
              id: res.id,
              producerId: res.producerId,
              kind: res.kind as "audio" | "video",
              rtpParameters: res.rtpParameters as RtpParameters,
            });
            const stream = new MediaStream([consumer.track]);
            setRemoteStreams((prev) => [...prev, stream]);
          }
        }
      );
    },
    [socket]
  );

  return {
    joinRoom,
    loadDevice,
    createSendTransport,
    createRecvTransport,
    produce,
    consume,
    localStream,
    remoteStreams,
    connected,
    socket,
    device: deviceRef.current,
  };
}
