// =============================================================================
// Worker Database Helper
// Creates a Drizzle ORM instance from a D1 binding (no getCloudflareContext)
// =============================================================================

import { drizzle } from "drizzle-orm/d1";
import * as schema from "../src/db/schema";

/**
 * Creates a Drizzle database instance for use in the worker context.
 * Unlike the Next.js app which uses getCloudflareContext, the worker
 * receives the D1 binding directly via the env parameter.
 */
export function createWorkerDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type WorkerDatabase = ReturnType<typeof createWorkerDb>;
