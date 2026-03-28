// =============================================================================
// Threads API Error Classifier
// =============================================================================
//
// Classifies Threads/Meta Graph API errors into categories that determine
// how the system should respond:
//   - retryable: temporary failures that may succeed on retry
//   - non_retryable: permanent failures where retry is pointless
//   - manual_intervention: situations requiring human review
// =============================================================================

import { ThreadsApiError } from "./types";

// =============================================================================
// Types
// =============================================================================

export type ErrorCategory = "retryable" | "non_retryable" | "manual_intervention";

export interface RetryConfig {
  shouldRetry: boolean;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface ClassifiedError {
  category: ErrorCategory;
  reason: string;
  originalError: unknown;
}

export interface GraphApiErrorDetail {
  message: string;
  type: string;
  code: number;
  errorSubcode?: number;
  fbtraceId?: string;
}

export interface RateLimitInfo {
  isLimited: boolean;
  /** Seconds until the rate limit resets, if available from headers */
  retryAfterSeconds?: number;
  /** Application-level usage percentage (0-100), if available */
  appUsagePercent?: number;
}

// =============================================================================
// Known Graph API error codes
// =============================================================================

/** Rate limiting codes from Meta Graph API */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

/** Auth / token error codes */
const AUTH_ERROR_CODES = new Set([102, 190]);

/** Permission denied subcodes */
const PERMISSION_DENIED_SUBCODES = new Set([458, 459, 460, 463, 467]);

/** Content policy violation codes */
const CONTENT_POLICY_CODES = new Set([368, 1349003]);

/** Account-level issues requiring manual intervention */
const ACCOUNT_ISSUE_CODES = new Set([
  2500, // Account suspended or restricted
]);

// =============================================================================
// classifyThreadsError
// =============================================================================

/**
 * Classifies an error from the Threads API into a category that determines
 * the appropriate system response.
 *
 * @param error - The caught error (may be ThreadsApiError, network error, etc.)
 * @returns A ClassifiedError with category and human-readable reason
 */
export function classifyThreadsError(error: unknown): ClassifiedError {
  // --- ThreadsApiError (structured API response) ---
  if (error instanceof ThreadsApiError) {
    return classifyApiError(error);
  }

  // --- Network / timeout errors ---
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return {
      category: "retryable",
      reason: "Network error: unable to reach Threads API",
      originalError: error,
    };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      category: "retryable",
      reason: "Request timed out",
      originalError: error,
    };
  }

  if (error instanceof Error && error.message.includes("ECONNRESET")) {
    return {
      category: "retryable",
      reason: "Connection reset by server",
      originalError: error,
    };
  }

  // --- Container-specific errors ---
  if (error instanceof Error) {
    if (error.message.includes("IN_PROGRESS")) {
      return {
        category: "retryable",
        reason: "Media container is still processing",
        originalError: error,
      };
    }

    if (error.message.includes("EXPIRED")) {
      return {
        category: "manual_intervention",
        reason: "Media container has expired; requires new container creation",
        originalError: error,
      };
    }
  }

  // --- Fallback: treat unknown errors as retryable once ---
  return {
    category: "retryable",
    reason: error instanceof Error ? error.message : "Unknown error",
    originalError: error,
  };
}

// =============================================================================
// getRetryConfig
// =============================================================================

/**
 * Returns retry configuration based on the error category.
 *
 * - retryable: exponential backoff with jitter, up to 5 retries
 * - non_retryable: no retry
 * - manual_intervention: no retry
 */
export function getRetryConfig(category: ErrorCategory): RetryConfig {
  switch (category) {
    case "retryable":
      return {
        shouldRetry: true,
        maxRetries: 5,
        baseDelay: 1_000, // 1 second
        maxDelay: 60_000, // 60 seconds
        backoffMultiplier: 2,
      };

    case "non_retryable":
      return {
        shouldRetry: false,
        maxRetries: 0,
        baseDelay: 0,
        maxDelay: 0,
        backoffMultiplier: 1,
      };

    case "manual_intervention":
      return {
        shouldRetry: false,
        maxRetries: 0,
        baseDelay: 0,
        maxDelay: 0,
        backoffMultiplier: 1,
      };
  }
}

// =============================================================================
// parseGraphApiError
// =============================================================================

/**
 * Parses a raw HTTP response body into a structured Graph API error detail.
 * Returns null if the response body is not a valid Graph API error format.
 *
 * @param responseBody - The raw JSON-parsed response body
 */
export function parseGraphApiError(
  responseBody: unknown,
): GraphApiErrorDetail | null {
  if (
    typeof responseBody !== "object" ||
    responseBody === null ||
    !("error" in responseBody)
  ) {
    return null;
  }

  const body = responseBody as {
    error?: {
      message?: string;
      type?: string;
      code?: number;
      error_subcode?: number;
      fbtrace_id?: string;
    };
  };

  const err = body.error;
  if (!err || typeof err.code !== "number") {
    return null;
  }

  return {
    message: err.message ?? "Unknown error",
    type: err.type ?? "UnknownError",
    code: err.code,
    errorSubcode: err.error_subcode,
    fbtraceId: err.fbtrace_id,
  };
}

// =============================================================================
// isRateLimited
// =============================================================================

/**
 * Detects rate limit status from HTTP response headers.
 *
 * Meta Graph API communicates rate limits through:
 * - HTTP 429 status code
 * - `x-app-usage` header (JSON with call_count, total_cputime, total_time)
 * - `x-business-use-case-usage` header
 * - `Retry-After` header (seconds)
 *
 * @param response - The raw fetch Response object
 * @returns RateLimitInfo with parsed rate limit details
 */
export function isRateLimited(response: Response): RateLimitInfo {
  // Explicit 429 status
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    return {
      isLimited: true,
      retryAfterSeconds: retryAfter ? parseInt(retryAfter, 10) || 60 : 60,
    };
  }

  // Parse x-app-usage header for proactive detection
  const appUsage = response.headers.get("x-app-usage");
  if (appUsage) {
    try {
      const usage = JSON.parse(appUsage) as {
        call_count?: number;
        total_cputime?: number;
        total_time?: number;
      };

      const maxUsage = Math.max(
        usage.call_count ?? 0,
        usage.total_cputime ?? 0,
        usage.total_time ?? 0,
      );

      // Treat 80%+ usage as rate-limited to proactively back off
      if (maxUsage >= 80) {
        return {
          isLimited: true,
          appUsagePercent: maxUsage,
          // Scale delay based on usage: 80% = 30s, 90% = 60s, 100% = 120s
          retryAfterSeconds: Math.ceil(((maxUsage - 70) / 30) * 120),
        };
      }

      return {
        isLimited: false,
        appUsagePercent: maxUsage,
      };
    } catch {
      // Malformed header; ignore
    }
  }

  return { isLimited: false };
}

// =============================================================================
// calculateRetryDelay
// =============================================================================

/**
 * Calculates the delay before the next retry attempt using exponential backoff
 * with jitter.
 *
 * @param attempt - The current attempt number (0-based)
 * @param config - The retry configuration
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
  // Add jitter: 50-100% of the calculated delay
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.floor(cappedDelay * jitter);
}

// =============================================================================
// Private helpers
// =============================================================================

function classifyApiError(error: ThreadsApiError): ClassifiedError {
  const { statusCode, code, errorSubcode } = error;

  // --- Rate limiting (retryable with backoff) ---
  if (statusCode === 429 || RATE_LIMIT_CODES.has(code)) {
    return {
      category: "retryable",
      reason: `Rate limited (code=${code}, status=${statusCode})`,
      originalError: error,
    };
  }

  // --- Server errors (retryable) ---
  if (statusCode >= 500 && statusCode < 600) {
    return {
      category: "retryable",
      reason: `Server error (status=${statusCode})`,
      originalError: error,
    };
  }

  // --- Temporary Graph API errors (retryable) ---
  // Code 1 = "unknown error" - often transient
  // Code 2 = "temporary service error"
  if (code === 1 || code === 2) {
    return {
      category: "retryable",
      reason: `Temporary Graph API error (code=${code}): ${error.message}`,
      originalError: error,
    };
  }

  // --- Auth / token errors (non-retryable) ---
  if (AUTH_ERROR_CODES.has(code)) {
    return {
      category: "non_retryable",
      reason: `Authentication error (code=${code}): ${error.message}`,
      originalError: error,
    };
  }

  // --- Permission denied (non-retryable) ---
  if (statusCode === 403 || (errorSubcode && PERMISSION_DENIED_SUBCODES.has(errorSubcode))) {
    return {
      category: "non_retryable",
      reason: `Permission denied (code=${code}, subcode=${errorSubcode}): ${error.message}`,
      originalError: error,
    };
  }

  // --- Content policy violation (non-retryable) ---
  if (CONTENT_POLICY_CODES.has(code)) {
    return {
      category: "non_retryable",
      reason: `Content policy violation (code=${code}): ${error.message}`,
      originalError: error,
    };
  }

  // --- Invalid input / bad request (non-retryable) ---
  if (statusCode === 400) {
    return {
      category: "non_retryable",
      reason: `Invalid request (code=${code}): ${error.message}`,
      originalError: error,
    };
  }

  // --- Account-level issues (manual intervention) ---
  if (ACCOUNT_ISSUE_CODES.has(code)) {
    return {
      category: "manual_intervention",
      reason: `Account issue (code=${code}): ${error.message}`,
      originalError: error,
    };
  }

  // --- Data deletion / GDPR requests (manual intervention) ---
  if (code === 100 && errorSubcode === 33) {
    return {
      category: "manual_intervention",
      reason: "Data has been deleted (possible GDPR request)",
      originalError: error,
    };
  }

  // --- Default: treat 4xx as non-retryable, everything else as retryable ---
  if (statusCode >= 400 && statusCode < 500) {
    return {
      category: "non_retryable",
      reason: `Client error (status=${statusCode}, code=${code}): ${error.message}`,
      originalError: error,
    };
  }

  return {
    category: "retryable",
    reason: `Unclassified error (status=${statusCode}, code=${code}): ${error.message}`,
    originalError: error,
  };
}
