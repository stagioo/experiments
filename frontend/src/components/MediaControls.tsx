import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Share } from "lucide-react";

interface MediaControlsProps {
  localStream: MediaStream | null;
  produce: (stream: MediaStream) => Promise<any>;
  joined: boolean;
}

const MediaControls = ({ localStream, produce, joined }: MediaControlsProps) => {
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
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


  const handleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
   
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
       
        await produce(screenStream);
        setIsScreenSharing(true);
      
        const [screenTrack] = screenStream.getVideoTracks();
        screenTrack.onended = () => {
          setIsScreenSharing(false);
        };
      } catch (err) {
        console.error("Error al compartir pantalla:", err);
        setIsScreenSharing(false);
      }
    } else {

      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          if (track.label.toLowerCase().includes("screen") || track.label.toLowerCase().includes("display")) {
            track.stop();
          }
        });
      }
      setIsScreenSharing(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-4 rounded-lg  z-50">
      <Button
        variant={isCameraOn ? "default" : "outline"}
        onClick={toggleCamera}
      >
        {isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
      </Button>
      <Button variant={isMicOn ? "default" : "outline"} onClick={toggleMic}>
        {isMicOn ? "Mute Mic" : "Unmute Mic"}
      </Button>
      {localStream && (
        <Button
          variant={isScreenSharing ? "default" : "outline"}
          onClick={handleScreenShare}
          className={isScreenSharing ? "bg-blue-600 text-white" : ""}
        >
          <Share className="mr-2 h-5 w-5" />
          {isScreenSharing ? "Stop Sharing" : "Share Screen"}
        </Button>
      )}
    </div>
  );
};

export default MediaControls;
