// =============================================================================
// Media Container State Machine & Publishing Pipeline
// =============================================================================
//
// Implements the Threads API recommended flow:
//   1. Create media container
//   2. Wait ~30 seconds for processing
//   3. Poll container status with exponential backoff
//   4. Publish when FINISHED, handle ERROR/EXPIRED gracefully
//
// State transitions:
//   CREATING_CONTAINER → WAITING_PROCESSING → POLLING_STATUS → PUBLISHING → PUBLISHED
//                                                ↓                            ↓
//                                            (ERROR/EXPIRED)              FAILED
// =============================================================================

import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import type { Database } from "@/db";
import { posts, publishAttempts } from "@/db/schema";
import type { ThreadsClient } from "./client";
import type { ContainerPublishingStatus } from "./types";

// =============================================================================
// Pipeline State Types
// =============================================================================

/** Pipeline states for the state machine */
export type PipelineState =
  | "CREATING_CONTAINER"
  | "WAITING_PROCESSING"
  | "POLLING_STATUS"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED";

/** DB-level status values for the publish_attempts table */
type AttemptStatus =
  | "creating"
  | "processing"
  | "polling"
  | "publishing"
  | "published"
  | "failed"
  | "expired";

/** A state transition recorded for audit purposes */
export interface StateTransition {
  from: PipelineState;
  to: PipelineState;
  timestamp: Date;
  detail?: string;
}

/** The result returned by the publish pipeline */
export interface PublishPipelineResult {
  success: boolean;
  threadsMediaId?: string;
  permalink?: string;
  finalState: PipelineState;
  transitions: StateTransition[];
  errorMessage?: string;
}

/** Configuration for the polling backoff strategy */
export interface PipelineConfig {
  /** Initial wait time in ms before first status check (default: 30_000) */
  initialWaitMs: number;
  /** Base intervals for exponential backoff polling in ms */
  pollIntervalsMs: number[];
  /** Maximum number of polling attempts (default: 5) */
  maxPollAttempts: number;
  /** Maximum number of container recreation attempts on EXPIRED (default: 1) */
  maxRecreationAttempts: number;
}

const DEFAULT_CONFIG: PipelineConfig = {
  initialWaitMs: 30_000,
  pollIntervalsMs: [30_000, 60_000, 120_000, 240_000, 480_000],
  maxPollAttempts: 5,
  maxRecreationAttempts: 1,
};

/** Input post data required by the pipeline */
export interface PipelinePost {
  id: string;
  content: string;
  mediaType: "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";
  mediaUrls?: string[] | null;
  topicTag?: string | null;
  replyControl?: "everyone" | "accounts_you_follow" | "mentioned_only";
  replyToId?: string | null;
}

// =============================================================================
// Container Status Helper
// =============================================================================

/**
 * Retrieves the current status of a media container from the Threads API.
 *
 * @param client - An authenticated ThreadsClient instance
 * @param containerId - The container ID to check
 * @returns The container's current publishing status and optional error message
 */
export async function getContainerStatus(
  client: ThreadsClient,
  containerId: string,
): Promise<{ status: ContainerPublishingStatus; errorMessage?: string }> {
  const result = await client.getContainerStatus(containerId);
  return {
    status: result.status,
    errorMessage: result.error_message,
  };
}

// =============================================================================
// State Machine Core
// =============================================================================

/**
 * Executes the full media container state machine for publishing a post.
 *
 * Flow:
 *   1. CREATING_CONTAINER: Create the media container via the Threads API
 *   2. WAITING_PROCESSING: Wait the recommended ~30s for server-side processing
 *   3. POLLING_STATUS: Poll container status with exponential backoff
 *      - FINISHED → proceed to PUBLISHING
 *      - IN_PROGRESS → retry with backoff
 *      - ERROR → mark FAILED
 *      - EXPIRED → attempt recreation (max 1 retry), then FAILED
 *   4. PUBLISHING: Publish the container
 *   5. PUBLISHED / FAILED: Terminal states
 *
 * All state transitions are recorded to the `publish_attempts` table for auditing.
 *
 * @param db - Drizzle database instance
 * @param client - An authenticated ThreadsClient
 * @param post - The post to publish
 * @param config - Optional pipeline configuration overrides
 * @returns The pipeline result with success flag, media ID, and audit trail
 */
export async function publishPost(
  db: Database,
  client: ThreadsClient,
  post: PipelinePost,
  config: Partial<PipelineConfig> = {},
): Promise<PublishPipelineResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const transitions: StateTransition[] = [];
  let currentState: PipelineState = "CREATING_CONTAINER";
  let attemptNumber = 1;
  let recreationCount = 0;

  // Helpers
  const recordTransition = (
    from: PipelineState,
    to: PipelineState,
    detail?: string,
  ) => {
    transitions.push({ from, to, timestamp: new Date(), detail });
    currentState = to;
  };

  const upsertAttempt = async (
    attemptId: string,
    fields: {
      containerId?: string | null;
      status: AttemptStatus;
      errorMessage?: string | null;
      completedAt?: Date;
    },
  ) => {
    await db
      .update(publishAttempts)
      .set({
        containerId: fields.containerId ?? undefined,
        status: fields.status,
        errorMessage: fields.errorMessage ?? undefined,
        completedAt: fields.completedAt ?? undefined,
      })
      .where(eq(publishAttempts.id, attemptId));
  };

  const fail = async (
    attemptId: string,
    errorMessage: string,
  ): Promise<PublishPipelineResult> => {
    const now = new Date();
    recordTransition(currentState, "FAILED", errorMessage);
    await upsertAttempt(attemptId, {
      status: "failed",
      errorMessage,
      completedAt: now,
    });
    await db
      .update(posts)
      .set({ status: "failed", errorMessage, updatedAt: now })
      .where(eq(posts.id, post.id));
    return {
      success: false,
      finalState: "FAILED",
      transitions,
      errorMessage,
    };
  };

  // Create the initial publish attempt record
  const attemptId = ulid();
  const startedAt = new Date();

  await db.insert(publishAttempts).values({
    id: attemptId,
    postId: post.id,
    containerId: null,
    status: "creating",
    attemptNumber,
    startedAt,
    createdAt: startedAt,
  });

  // Update post status to "publishing"
  await db
    .update(posts)
    .set({ status: "publishing", updatedAt: startedAt })
    .where(eq(posts.id, post.id));

  // =========================================================================
  // STATE: CREATING_CONTAINER
  // =========================================================================

  let containerId: string;

  const createContainer = async (): Promise<string> => {
    switch (post.mediaType) {
      case "TEXT":
        return client.createTextPost({
          text: post.content,
          replyControl: post.replyControl,
          topicTag: post.topicTag ?? undefined,
          replyToId: post.replyToId ?? undefined,
        });
      case "IMAGE": {
        const imageUrl = post.mediaUrls?.[0];
        if (!imageUrl) throw new Error("IMAGE post requires at least one media URL");
        return client.createImagePost({
          text: post.content,
          imageUrl,
          replyControl: post.replyControl,
          topicTag: post.topicTag ?? undefined,
        });
      }
      case "VIDEO": {
        const videoUrl = post.mediaUrls?.[0];
        if (!videoUrl) throw new Error("VIDEO post requires at least one media URL");
        return client.createVideoPost({
          text: post.content,
          videoUrl,
          replyControl: post.replyControl,
          topicTag: post.topicTag ?? undefined,
        });
      }
      case "CAROUSEL": {
        if (!post.mediaUrls?.length) {
          throw new Error("CAROUSEL post requires at least two media URLs");
        }
        return client.createCarouselPost({
          text: post.content,
          children: post.mediaUrls.map((url) => ({
            mediaType: "IMAGE" as const,
            url,
          })),
          replyControl: post.replyControl,
          topicTag: post.topicTag ?? undefined,
        });
      }
      default:
        throw new Error(`Unsupported media type: ${post.mediaType}`);
    }
  };

  try {
    containerId = await createContainer();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Container creation failed";
    return fail(attemptId, message);
  }

  recordTransition("CREATING_CONTAINER", "WAITING_PROCESSING", `container=${containerId}`);
  await upsertAttempt(attemptId, {
    containerId,
    status: "processing",
  });

  // =========================================================================
  // STATE: WAITING_PROCESSING (initial ~30s wait)
  // =========================================================================

  await sleep(cfg.initialWaitMs);

  recordTransition("WAITING_PROCESSING", "POLLING_STATUS");
  await upsertAttempt(attemptId, { status: "polling" });

  // =========================================================================
  // STATE: POLLING_STATUS (exponential backoff)
  // =========================================================================

  let readyToPublish = false;

  for (let poll = 0; poll < cfg.maxPollAttempts; poll++) {
    let containerStatus: { status: ContainerPublishingStatus; errorMessage?: string };

    try {
      containerStatus = await getContainerStatus(client, containerId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch container status";
      return fail(attemptId, message);
    }

    const detail = `poll=${poll + 1}/${cfg.maxPollAttempts} status=${containerStatus.status}`;

    if (containerStatus.status === "FINISHED") {
      // Ready to publish
      recordTransition("POLLING_STATUS", "PUBLISHING", detail);
      await upsertAttempt(attemptId, { status: "publishing" });
      readyToPublish = true;
      break;
    }

    if (containerStatus.status === "PUBLISHED") {
      // Already published (edge case) - treat as success
      recordTransition("POLLING_STATUS", "PUBLISHED", detail);
      const now = new Date();
      await upsertAttempt(attemptId, {
        status: "published",
        completedAt: now,
      });
      await db
        .update(posts)
        .set({
          status: "published",
          threadsMediaId: containerId,
          publishedAt: now,
          updatedAt: now,
        })
        .where(eq(posts.id, post.id));
      return {
        success: true,
        threadsMediaId: containerId,
        finalState: "PUBLISHED",
        transitions,
      };
    }

    if (containerStatus.status === "ERROR") {
      const errorDetail = containerStatus.errorMessage ?? "Unknown container error";
      return fail(attemptId, `Container error: ${errorDetail}`);
    }

    if (containerStatus.status === "EXPIRED") {
      // Attempt recreation if allowed
      if (recreationCount < cfg.maxRecreationAttempts) {
        recreationCount++;
        attemptNumber++;

        // Create a new attempt record for the retry
        const retryAttemptId = ulid();
        const retryStartedAt = new Date();

        await upsertAttempt(attemptId, {
          status: "expired",
          errorMessage: "Container expired, attempting recreation",
          completedAt: retryStartedAt,
        });

        await db.insert(publishAttempts).values({
          id: retryAttemptId,
          postId: post.id,
          containerId: null,
          status: "creating",
          attemptNumber,
          startedAt: retryStartedAt,
          createdAt: retryStartedAt,
        });

        recordTransition(
          "POLLING_STATUS",
          "CREATING_CONTAINER",
          `expired, recreation attempt ${recreationCount}`,
        );

        // Recreate the container
        try {
          containerId = await createContainer();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Container recreation failed";
          // Fail the retry attempt
          await db
            .update(publishAttempts)
            .set({
              status: "failed",
              errorMessage: message,
              completedAt: new Date(),
            })
            .where(eq(publishAttempts.id, retryAttemptId));
          return fail(attemptId, message);
        }

        // Update the retry attempt with the new container ID
        await db
          .update(publishAttempts)
          .set({ containerId, status: "processing" })
          .where(eq(publishAttempts.id, retryAttemptId));

        recordTransition(
          "CREATING_CONTAINER",
          "WAITING_PROCESSING",
          `recreated container=${containerId}`,
        );

        // Wait again for the new container
        await sleep(cfg.initialWaitMs);

        recordTransition("WAITING_PROCESSING", "POLLING_STATUS");
        await db
          .update(publishAttempts)
          .set({ status: "polling" })
          .where(eq(publishAttempts.id, retryAttemptId));

        // Reset poll counter for the new container
        poll = -1; // Will be incremented to 0 at next iteration
        continue;
      }

      return fail(
        attemptId,
        "Container expired and max recreation attempts exhausted",
      );
    }

    // IN_PROGRESS: wait with exponential backoff then continue polling
    if (containerStatus.status === "IN_PROGRESS") {
      const waitMs = cfg.pollIntervalsMs[Math.min(poll, cfg.pollIntervalsMs.length - 1)]!;
      recordTransition(
        "POLLING_STATUS",
        "POLLING_STATUS",
        `${detail}, backoff=${waitMs}ms`,
      );
      await sleep(waitMs);
      continue;
    }

    // Unknown status - treat as error
    return fail(
      attemptId,
      `Unknown container status: ${containerStatus.status}`,
    );
  }

  // If we exited the loop without reaching PUBLISHING state, it means
  // max poll attempts were exhausted while still IN_PROGRESS
  if (!readyToPublish) {
    return fail(
      attemptId,
      `Container did not finish processing after ${cfg.maxPollAttempts} polling attempts`,
    );
  }

  // =========================================================================
  // STATE: PUBLISHING
  // =========================================================================

  let publishResult: { id: string };

  try {
    publishResult = await client.publishPost(containerId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to publish container";
    return fail(attemptId, message);
  }

  // =========================================================================
  // STATE: PUBLISHED (terminal success)
  // =========================================================================

  const publishedAt = new Date();

  recordTransition("PUBLISHING", "PUBLISHED", `threadsMediaId=${publishResult.id}`);

  await upsertAttempt(attemptId, {
    status: "published",
    completedAt: publishedAt,
  });

  // Fetch permalink (non-critical)
  let permalink: string | undefined;
  try {
    const threadPost = await client.getPost(publishResult.id);
    permalink = threadPost.permalink ?? undefined;
  } catch {
    // Permalink fetch is non-critical, continue
  }

  await db
    .update(posts)
    .set({
      status: "published",
      threadsMediaId: publishResult.id,
      publishedAt,
      permalink: permalink ?? null,
      updatedAt: publishedAt,
    })
    .where(eq(posts.id, post.id));

  return {
    success: true,
    threadsMediaId: publishResult.id,
    permalink,
    finalState: "PUBLISHED",
    transitions,
  };
}

// =============================================================================
// Utilities
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
