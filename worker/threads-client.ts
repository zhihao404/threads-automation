// =============================================================================
// Minimal Threads API Client for the Worker
// Re-exports the ThreadsClient from src/lib/threads/client.ts
//
// The worker uses relative imports to reference the shared client code.
// This re-export file exists to provide a clean import path for worker handlers.
// =============================================================================

export { ThreadsClient } from "../src/lib/threads/client";
