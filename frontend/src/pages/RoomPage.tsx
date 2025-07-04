import { useState } from "react";
import { useMediasoupClient } from "../hooks/useMediasoupClient";
import MediaControls from "../components/MediaControls";

const RoomPage = () => {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const {
    joinRoom,
    loadDevice,
    createSendTransport,
    createRecvTransport,
    produce,
    localStream,
    remoteStreams,
    connected,
    socket,
    consume,
    device,
  } = useMediasoupClient();

  const handleJoin = async () => {
    if (!roomId || !socket) return;
    await joinRoom(roomId);
    setJoined(true);
    // Fetch router RTP capabilities from backend
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
    if (!socket) return;
    if (!device?.rtpCapabilities) {
      console.error("Device RTP capabilities not loaded!");
      return;
    }
    socket.emit("getRoomProducers", {}, async (producerIds: string[]) => {
      for (const producerId of producerIds) {
        await consume(producerId, device.rtpCapabilities);
      }
    });
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
            className="bg-blue-500 text-white px-4 py-2 rounded"
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
            {localStream && (
              <video
                className="border"
                width={240}
                height={180}
                autoPlay
                muted
                ref={(video) => {
                  if (video && localStream) video.srcObject = localStream;
                }}
              />
            )}
            {remoteStreams.map((stream, i) => (
              <video
                key={i}
                className="border"
                width={240}
                height={180}
                autoPlay
                ref={(video) => {
                  if (video) video.srcObject = stream;
                }}
              />
            ))}
          </div>
          {joined && localStream && <MediaControls localStream={localStream} />}
        </>
      )}
    </div>
  );
};

export default RoomPage;
