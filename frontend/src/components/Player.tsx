import { useEffect, useRef } from "react";

interface PlayerProps {
  stream: MediaStream;
  name: string;
  you?: boolean;
  audioStream?: MediaStream;
}

const Player = ({ stream, name, you = false, audioStream }: PlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current && audioStream) {
      audioRef.current.srcObject = audioStream;
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error);
      });
    }
  }, [audioStream]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={you} // Only mute local video to prevent echo
        className="rounded-lg shadow-lg w-[320px] h-[240px] bg-black"
      />
      {audioStream && <audio ref={audioRef} autoPlay playsInline />}
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-sm">
        {name}
      </div>
    </div>
  );
};

export default Player;
