import { useState, useEffect, useRef } from "react";

interface MediaControlsProps {
  localStream: MediaStream | null;
}

const MediaControls = ({ localStream }: MediaControlsProps) => {
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !isCameraOn;
      });
      setIsCameraOn((prev) => !prev);
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMicOn;
      });
      setIsMicOn((prev) => !prev);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-4 bg-white/80 rounded-lg shadow-lg px-6 py-3 z-50">
      <button
        className={`px-4 py-2 rounded ${
          isCameraOn ? "bg-green-600" : "bg-gray-400"
        } text-white font-semibold`}
        onClick={toggleCamera}
      >
        {isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
      </button>
      <button
        className={`px-4 py-2 rounded ${
          isMicOn ? "bg-green-600" : "bg-gray-400"
        } text-white font-semibold`}
        onClick={toggleMic}
      >
        {isMicOn ? "Mute Mic" : "Unmute Mic"}
      </button>
    </div>
  );
};

export default MediaControls;
