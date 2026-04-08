import { processEmailJob } from "./app/lib/email-jobs";
import openNextWorker, {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "./.open-next/worker.js";

function syncProcessEnvFromBindings(env) {
  if (!env || typeof env !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }
}

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge };

const worker = {
  async fetch(request, env, ctx) {
    if (!openNextWorker?.fetch) {
      throw new Error("OpenNext worker does not export a fetch handler.");
    }

    return openNextWorker.fetch(request, env, ctx);
  },

  async queue(batch, env) {
    syncProcessEnvFromBindings(env);

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

export default worker;
