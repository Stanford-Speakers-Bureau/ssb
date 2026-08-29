import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  // Background ISR revalidation queue. Without this, revalidating a stale
  // page falls back to a dummy queue that throws "Dummy queue is not
  // implemented" (see DOQueueHandler binding in wrangler.jsonc).
  queue: doQueue,
  // Durable-Object-backed tag cache for revalidateTag / revalidatePath.
  tagCache: doShardedTagCache(),
  // NOTE: no `cachePurge` override. CDN-tag purging only matters with
  // edge cache interception, which is off here, and it needs
  // CACHE_PURGE_ZONE_ID + CACHE_PURGE_API_TOKEN (not configured). Add it
  // back only if you turn on edge caching and set those secrets.
});
