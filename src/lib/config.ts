import {
  RtpCodecCapability,
  TransportListenInfo,
  WorkerLogTag,
} from "mediasoup/node/lib/types";
import os from "os";

export const config = {
  listenIp: "0.0.0.0",
  listenPort: 3016,
  mediasoup: {
    numWorkers: Object.keys(os.cpus()).length,
    workerSettings: {
      logLevel: "debug",
      logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"] as WorkerLogTag[],
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
    },
    router: {
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: "video",
          mimeType: "video/VP8",
          clockRate: 90000,
          parameters: {
            "x-google-start-bitrate": 1000,
          },
        },
      ] as RtpCodecCapability[],
    },
    webRtcTransport: {
      listenIps: [
        {
          ip: "0.0.0.0",
          announcedIp: "127.0.0.1",
        },
      ] as TransportListenInfo[],
    },
  },
} as const;
