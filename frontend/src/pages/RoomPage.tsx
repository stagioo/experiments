import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useMediasoupClient } from "../hooks/useMediasoupClient";
import MediaControls from "../components/MediaControls";
import Player from "../components/Player";

// interface RemoteStream {
//   stream: MediaStream;
//   userId: string;
//   kind: "audio" | "video";
// }

const RoomPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
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

  const [roomId, setRoomId] = useState(searchParams.get("room") || "");
  const [joined, setJoined] = useState(false);
  const consumedProducersRef = useRef<Set<string>>(new Set());
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});

  const consumeAndAddTrack = useCallback(
    async ({
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

          consumedProducersRef.current.add(producerId);

          //
          // we have to check if the stream for the user already exists
          // and then we will add new tracks to this stream if it exists
          // else we will create a new stream (!This is important)
          //

          const newTrack = stream.getTracks()[0];
          console.log(`Adding ${kind} track from user ${userId}`);

          setRemoteStreams((prevStreams) => {
            const newStreams = { ...prevStreams };
            let existingStream = newStreams[userId];

            if (existingStream) {
              existingStream.addTrack(newTrack);
            } else {
              existingStream = new MediaStream([newTrack]);
              newStreams[userId] = existingStream;
            }

            return newStreams;
          });
        },
      );
    },
    [consume, device],
  );

  // Auto-join room if roomId is in URL
  useEffect(() => {
    const roomFromUrl = searchParams.get("room");
    if (roomFromUrl && !joined && connected) {
      setRoomId(roomFromUrl);
      handleJoin();
    }
  }, [searchParams, connected]);

  // Handle new producer notifications
  useEffect(() => {
    if (!socket || !joined) return;

    const handleNewProducer = async ({
      producerId,
      userId,
      kind,
    }: {
      producerId: string;
      userId: string;
      kind: "audio" | "video";
    }) => {
      console.log("Received newProducer event: ", { producerId, userId, kind });
      await consumeAndAddTrack({
        producerId,
        userId,
        kind,
      });
    };

    console.log("Setting up newProducer listener");
    socket.on("newProducer", handleNewProducer);

    return () => {
      console.log("Cleaning up newProducer listener");
      socket.off("newProducer", handleNewProducer);
    };
  }, [socket, joined, consumeAndAddTrack]);

  const handleJoin = async () => {
    if (!roomId || !socket) return;

    try {
      const { producers: existingProducers } = await joinRoom(roomId);
      setJoined(true);
      // Update URL with room ID
      setSearchParams({ room: roomId });

      // Get router RTP capabilities
      const rtpCapabilities = await new Promise((resolve) => {
        socket.emit("getRouterRtpCapabilities", {}, resolve);
      });

      // Load device and create transports
      await loadDevice(
        rtpCapabilities as import("mediasoup-client/types").RtpCapabilities,
      );
      await createSendTransport();
      await createRecvTransport();

      console.log(`Existing Producers;: `, existingProducers.length);
      for (const { producerId, userId, kind } of existingProducers) {
        await consumeAndAddTrack({
          producerId,
          userId,
          kind,
        });
      }

      console.log("Successfully joined and set up room:", roomId);
    } catch (error) {
      console.error("Error joining room:", error);
      setJoined(false);
      // Remove room from URL on error
      setSearchParams({});
    }
  };

  const handleProduce = async () => {
    console.log("Starting media production");
    await produce();
    console.log("Media production started");

    console.log("Media production completed successfully");
  };

  const handleLeaveRoom = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    Object.values(remoteStreams).forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    setJoined(false);
    setRemoteStreams({});
    consumedProducersRef.current.clear();
    // Remove room from URL
    setSearchParams({});
    // Optionally navigate to home
    navigate("/");
  };

  // useEffect(() => {
  //   console.log("Remote Stream:: ", remoteStreams);
  //   console.log("Local Strem:: ", localStream);

  //   return () => {
  //     if (localStream) {
  //       localStream.getTracks().forEach((track) => track.stop());
  //     }
  //     // remoteStreams.forEach(({ stream }) => {
  //     //   stream.getTracks().forEach((track) => track.stop());
  //     // });
  //   };
  // }, [localStream, remoteStreams]);

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
          <div className="flex gap-2">
            <button
              className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              onClick={handleProduce}
            >
              Start Camera & Produce
            </button>
            <button
              className="bg-red-500 text-white px-4 py-2 rounded"
              onClick={handleLeaveRoom}
            >
              Leave Room
            </button>
          </div>
          <div className="flex gap-4 mt-4">
            {localStream && <Player stream={localStream} name="You" you />}
            {Object.entries(remoteStreams).map(([userId, stream]) => (
              <Player
                key={userId}
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
