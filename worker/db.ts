// =============================================================================
// Worker Database Helper
// Re-exports from the shared DB module for backward compatibility
// =============================================================================

import { createDb } from "../src/db";
import type { Database } from "../src/db";

/**
 * Creates a Drizzle database instance for use in the worker context.
 * Delegates to the shared createDb function.
 */
export const createWorkerDb = createDb;

export type WorkerDatabase = Database;
