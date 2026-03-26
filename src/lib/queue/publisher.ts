// =============================================================================
// Queue Message Publisher
// Sends messages to Cloudflare Queues from Next.js API routes
// =============================================================================

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { JobMessage } from "./types";

/**
 * Enqueues a job message to the POST_QUEUE for immediate processing.
 */
export async function enqueueJob(message: JobMessage): Promise<void> {
  const { env } = await getCloudflareContext({ async: true });
  await env.POST_QUEUE.send(message);
}

/**
 * Enqueues a job message to the POST_QUEUE with a delay before it becomes visible.
 *
 * @param message - The job message to enqueue
 * @param delaySeconds - Number of seconds to delay before the message becomes available
 */
export async function enqueueJobWithDelay(
  message: JobMessage,
  delaySeconds: number,
): Promise<void> {
  const { env } = await getCloudflareContext({ async: true });
  await env.POST_QUEUE.send(message, { delaySeconds });
}
