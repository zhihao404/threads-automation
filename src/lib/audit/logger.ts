import { ulid } from "ulid";
import type { Database } from "@/db";
import { auditEvents } from "@/db/schema";

// =============================================================================
// Types
// =============================================================================

export type ActorType = "user" | "system" | "webhook" | "cron";

export type AuditAction =
  | "post.create"
  | "post.update"
  | "post.publish"
  | "post.delete"
  | "reply.send"
  | "reply.approve"
  | "account.connect"
  | "account.disconnect"
  | "token.refresh"
  | "data_deletion.request"
  | "data_deletion.complete"
  | "webhook.receive"
  | "webhook.duplicate"
  | "webhook.replay_rejected";

export type ResourceType =
  | "post"
  | "reply"
  | "account"
  | "template"
  | "webhook_event";

export interface AuditEventInput {
  actorId?: string | null;
  actorType: ActorType;
  action: AuditAction;
  resourceType?: ResourceType | null;
  resourceId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

// =============================================================================
// Sensitive field stripping
// =============================================================================

/** Fields that must never appear in audit logs */
const SENSITIVE_FIELDS = new Set([
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "id_token",
  "idToken",
  "password",
  "secret",
  "app_secret",
  "appSecret",
  "api_key",
  "apiKey",
  "authorization",
  "cookie",
  "x-hub-signature-256",
  "signed_request",
  "signedRequest",
]);

/** PII fields that should be redacted */
const PII_FIELDS = new Set([
  "email",
  "phone",
  "phoneNumber",
  "phone_number",
  "ip_address",
  "ipAddress",
  "ssn",
  "social_security",
]);

/**
 * Recursively strip sensitive fields from an object for audit logging.
 * Tokens, secrets, and PII are replaced with "[REDACTED]".
 */
function sanitizeForAudit(
  obj: unknown,
  depth = 0,
): unknown {
  // Prevent infinite recursion
  if (depth > 10) return "[MAX_DEPTH]";

  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (typeof obj === "number" || typeof obj === "boolean") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForAudit(item, depth + 1));
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.has(key) || SENSITIVE_FIELDS.has(lowerKey)) {
        sanitized[key] = "[REDACTED]";
      } else if (PII_FIELDS.has(key) || PII_FIELDS.has(lowerKey)) {
        sanitized[key] = "[REDACTED_PII]";
      } else {
        sanitized[key] = sanitizeForAudit(value, depth + 1);
      }
    }
    return sanitized;
  }

  return String(obj);
}

// =============================================================================
// Core audit logging function
// =============================================================================

/**
 * Log an audit event to the database.
 * Automatically sanitizes before/after state and metadata to strip tokens and PII.
 */
export async function logAuditEvent(
  db: Database,
  event: AuditEventInput,
): Promise<string> {
  const id = ulid();
  const now = new Date();

  const sanitizedBefore = event.beforeState
    ? JSON.stringify(sanitizeForAudit(event.beforeState))
    : null;

  const sanitizedAfter = event.afterState
    ? JSON.stringify(sanitizeForAudit(event.afterState))
    : null;

  const sanitizedMetadata = event.metadata
    ? JSON.stringify(sanitizeForAudit(event.metadata))
    : null;

  await db.insert(auditEvents).values({
    id,
    actorId: event.actorId ?? null,
    actorType: event.actorType,
    action: event.action,
    resourceType: event.resourceType ?? null,
    resourceId: event.resourceId ?? null,
    beforeState: sanitizedBefore,
    afterState: sanitizedAfter,
    metadata: sanitizedMetadata,
    ipAddress: event.ipAddress ?? null,
    createdAt: now,
  });

  return id;
}
