import { processEmailJob } from "./app/lib/email-jobs";

const openNextWorkerPath = "./.open-next/worker.js";
let openNextWorkerPromise;

async function getOpenNextWorker() {
  if (!openNextWorkerPromise) {
    openNextWorkerPromise = import(openNextWorkerPath).then((mod) => mod.default);
  }

  return openNextWorkerPromise;
}

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

export default {
  async fetch(request, env, ctx) {
    const worker = await getOpenNextWorker();

    if (!worker?.fetch) {
      throw new Error("OpenNext worker does not export a fetch handler.");
    }

    return worker.fetch(request, env, ctx);
  },

  async queue(batch) {
    await Promise.all(
      batch.messages.map(async (message) => {
        try {
          await processEmailJob(message.body);
          message.ack();
        } catch (error) {
          console.error("Email queue consumer error:", {
            id: message.id,
            attempts: message.attempts,
            kind: message.body?.kind,
            error,
          });
          message.retry();
        }
      }),
    );
  },
};
