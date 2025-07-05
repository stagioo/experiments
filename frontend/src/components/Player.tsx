// import { User } from "lucide-react";

interface PlayerProps {
  stream: MediaStream;
  name: string;
  you: boolean;
}

const Player = ({ stream, name, you }: PlayerProps) => {
  return (
    <div className="border flex flex-col items-center gap-2 size-60 bg-white/80 rounded-lg p-2 overflow-hidden">
      {/* {you && <User className="w-4 h-4" />} */}
      <span>{name}</span>
      <video
        className="size-full"
        muted={you}
        autoPlay
        ref={(video) => {
          if (video) video.srcObject = stream;
        }}
      />
    </div>
  );
};

export default Player;
