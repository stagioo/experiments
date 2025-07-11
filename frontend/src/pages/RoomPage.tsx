import { useState, useRef, useEffect } from "react";
import { useMediasoupClient } from "../hooks/useMediasoupClient";
import MediaControls from "../components/MediaControls";
import Player from "../components/Player";

interface RemoteStream {
  stream: MediaStream;
  userId: string;
  kind: "audio" | "video";
}

const RoomPage = () => {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const consumedProducersRef = useRef<Set<string>>(new Set());
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const {
    joinRoom,
    loadDevice,
    createSendTransport,
    createRecvTransport,
    produce,
    localStream,
    connected,
    socket,
    consume,
    device,
  } = useMediasoupClient();

  // Handle new producer notifications
  useEffect(() => {
    if (!socket || !device?.rtpCapabilities || !joined) return;

    const handleNewProducer = async ({
      producerId,
      userId,
      kind,
    }: {
      producerId: string;
      userId: string;
      kind: "audio" | "video";
    }) => {
      console.log("Received newProducer event:", { producerId, userId, kind });

      if (consumedProducersRef.current.has(producerId)) {
        console.log("Producer already consumed, skipping:", producerId);
        return;
      }

      await consume(
        producerId,
        device.rtpCapabilities,
        (stream: MediaStream) => {
          console.log("Successfully consumed producer:", {
            producerId,
            userId,
            kind,
          });
          setRemoteStreams((prev) => [...prev, { stream, userId, kind }]);
        }
      );
      consumedProducersRef.current.add(producerId);
    };

    console.log("Setting up newProducer listener");
    socket.on("newProducer", handleNewProducer);

    return () => {
      console.log("Cleaning up newProducer listener");
      socket.off("newProducer", handleNewProducer);
    };
  }, [socket, device?.rtpCapabilities, joined, consume]);

  // Group streams by user
  const remoteStreamsByUser = remoteStreams.reduce<
    Record<string, { video?: MediaStream; audio?: MediaStream }>
  >((acc, { stream, userId, kind }) => {
    if (!acc[userId]) {
      acc[userId] = {};
    }
    acc[userId][kind] = stream;
    return acc;
  }, {});

  const handleJoin = async () => {
    if (!roomId || !socket) return;
    console.log("Joining room:", roomId);

    await joinRoom(roomId);
    setJoined(true);
    console.log("Successfully joined room");

    // Get router RTP capabilities
    const rtpCapabilities = await new Promise((resolve) => {
      socket.emit("getRouterRtpCapabilities", {}, resolve);
    });
    console.log("Got router RTP capabilities");

    // Load device and create transports
    await loadDevice(
      rtpCapabilities as import("mediasoup-client/types").RtpCapabilities
    );
    console.log("Device loaded");

    await createSendTransport();
    console.log("Send transport created");

    await createRecvTransport();
    console.log("Receive transport created");

    // Consume existing producers in the room
    console.log("Requesting existing producers");
    socket.emit(
      "getRoomProducersWithUsers",
      {},
      async (producerList: { producerId: string; userId: string }[]) => {
        console.log("Got existing producers:", producerList);

        if (!device?.rtpCapabilities) {
          console.warn("Device not ready for consuming");
          return;
        }

        for (const { producerId, userId } of producerList) {
          if (consumedProducersRef.current.has(producerId)) {
            console.log("Producer already consumed, skipping:", producerId);
            continue;
          }

          console.log("Consuming producer:", { producerId, userId });
          await consume(
            producerId,
            device.rtpCapabilities,
            (stream: MediaStream) => {
              console.log("Successfully consumed producer:", {
                producerId,
                userId,
              });
              setRemoteStreams((prev) => [
                ...prev,
                { stream, userId, kind: "video" }, // Assuming all consumed are video for now
              ]);
            }
          );
          consumedProducersRef.current.add(producerId);
        }
      }
    );
  };

  const handleProduce = async () => {
    console.log("Starting media production");
    await produce();
    console.log("Media production started");

    console.log("Media production completed successfully");
  };

  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      remoteStreams.forEach(({ stream }) => {
        stream.getTracks().forEach((track) => track.stop());
      });
    };
  }, [localStream, remoteStreams]);

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      <h1 className="text-2xl font-bold">Mediasoup Room Test</h1>
      {!joined ? (
        <div className="flex flex-col gap-2">
          <input
            className="border p-2 rounded"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            onClick={handleJoin}
            disabled={!connected || !roomId}
          >
            Join Room
          </button>
        </div>
      ) : (
        <>
          <button
            className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            onClick={handleProduce}
          >
            Start Camera & Produce
          </button>
          <div className="flex gap-4 mt-4">
            {localStream && <Player stream={localStream} name="You" you />}
            {Object.entries(remoteStreamsByUser).map(([userId, streams]) => (
              <div key={userId}>
                {streams.video && (
                  <Player
                    stream={streams.video}
                    name={`User ${userId}`}
                    you={false}
                    audioStream={streams.audio}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {joined && localStream && <MediaControls localStream={localStream} />}
    </div>
  );
};

export default RoomPage;
