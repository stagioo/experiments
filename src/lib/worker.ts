import * as mediasoup from "mediasoup";
import { config } from "./config";
import { Router, Worker } from "mediasoup/node/lib/types";

const worker: Array<{
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
    console.error("mediasoup worker died");
    setTimeout(() => {
      console.log("mediasoup worker restarting...");
      createWorker();
    }, 2000);
  });
}
