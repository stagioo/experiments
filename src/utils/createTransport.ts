import { Router, WebRtcTransport } from "mediasoup/node/lib/types";
import { config } from "../lib/config";

export const transportToOptions = ({
  id,
  iceParameters,
  iceCandidates,
  dtlsParameters,
}: WebRtcTransport) => ({ id, iceParameters, iceCandidates, dtlsParameters });

export type TransportOptions = ReturnType<typeof transportToOptions>;

export const createTransport = async (router: Router, peerId: string) => {
  const { listenIps, initialAvailableOutgoingBitrate } =
    config.mediasoup.webRtcTransport;

  const transport = await router.createWebRtcTransport({
    listenIps: listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: initialAvailableOutgoingBitrate,
    appData: { peerId },
  });
  return transport;
};
