import { useState, useRef } from "react";
import { useMediasoupClient } from "../hooks/useMediasoupClient";
import MediaControls from "../components/MediaControls";
import Player from "../components/Player";

const RoomPage = () => {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const consumedProducersRef = useRef<Set<string>>(new Set());
  const [remoteStreamsWithUsers, setRemoteStreamsWithUsers] = useState<
    { stream: MediaStream; userId: string }[]
  >([]);
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

  const handleJoin = async () => {
    if (!roomId || !socket) return;
    await joinRoom(roomId);
    setJoined(true);
    const rtpCapabilities = await new Promise((resolve) => {
      socket.emit("getRouterRtpCapabilities", {}, resolve);
    });
    await loadDevice(
      rtpCapabilities as import("mediasoup-client/types").RtpCapabilities
    );
    await createSendTransport();
    await createRecvTransport();
  };

  const handleProduce = async () => {
    await produce();
    if (!socket || !device?.rtpCapabilities) return;
    socket.emit(
      "getRoomProducersWithUsers",
      {},
      async (producerList: { producerId: string; userId: string }[]) => {
        const newProducers = producerList.filter(
          (p) => !consumedProducersRef.current.has(p.producerId)
        );
        for (const { producerId, userId } of newProducers) {
          await consume(
            producerId,
            device.rtpCapabilities,
            (stream: MediaStream) => {
              setRemoteStreamsWithUsers((prev) => [
                ...prev,
                { stream, userId },
              ]);
            }
          );
          consumedProducersRef.current.add(producerId);
        }
      }
    );
  };

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
            // disabled={!device?.rtpCapabilities}
          >
            Start Camera & Produce
          </button>
          <div className="flex gap-4 mt-4">
            {localStream && <Player stream={localStream} name="You" you />}
            {remoteStreamsWithUsers.map(({ stream, userId }, i) => (
              <Player
                key={i}
                stream={stream}
                name={`User ${userId}`}
                you={false}
              />
            ))}
          </div>
        </>
      )}
      {joined && localStream && <MediaControls localStream={localStream} />}
    </div>
  );
};

export default RoomPage;
