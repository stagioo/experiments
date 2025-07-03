import * as mediasoup from "mediasoup";
import { config } from "./config";
import { Router } from "mediasoup/node/lib/types";
import { Worker } from "mediasoup/node/lib/types";

const workers: Array<{
  worker: Worker;
  router: Router;
}> = [];

let nextWorkerIndex = 0;

export async function createWorker() {
  const worker = await mediasoup.createWorker({
    logLevel: config.mediasoup.workerSettings.logLevel,
    logTags: config.mediasoup.workerSettings.logTags,
    rtcMinPort: config.mediasoup.workerSettings.rtcMinPort,
    rtcMaxPort: config.mediasoup.workerSettings.rtcMaxPort,
  });

  worker.on("died", () => {
    console.error("mediasoup worker died", worker.pid);
    setTimeout(() => {
      process.exit(1);
    }, 2000);
  });

  const mediaCodecs = config.mediasoup.router.mediaCodecs;
  const router = await worker.createRouter({
    mediaCodecs,
  });

  return router;
}
