// =============================================================================
// Verify Meta signed_request HMAC-SHA256 signature
// Uses Web Crypto API (crypto.subtle) for Cloudflare Workers/Edge compatibility
// =============================================================================

/**
 * Timing-safe comparison of two ArrayBuffers.
 * Prevents timing attacks by always comparing all bytes.
 */
function timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  const viewA = new Uint8Array(a);
  const viewB = new Uint8Array(b);
  if (viewA.length !== viewB.length) return false;
  let result = 0;
  for (let i = 0; i < viewA.length; i++) {
    result |= (viewA[i] as number) ^ (viewB[i] as number);
  }
  return result === 0;
}

/**
 * Convert a base64url string to a standard base64 string.
 */
function base64urlToBase64(input: string): string {
  return input.replace(/-/g, "+").replace(/_/g, "/");
}

/**
 * Verify a Meta signed_request and return the decoded payload.
 *
 * The signed_request format is: base64url(hmac_sha256_signature).base64url(json_payload)
 *
 * @param signedRequest - The signed_request string from Meta
 * @param appSecret - The THREADS_APP_SECRET used as HMAC key
 * @returns The decoded JSON payload if valid, or null if verification fails
 */
export async function verifySignedRequest<T = Record<string, unknown>>(
  signedRequest: string,
  appSecret: string,
): Promise<T | null> {
  const parts = signedRequest.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encodedSignature, encodedPayload] = parts;
  if (!encodedSignature || !encodedPayload) {
    return null;
  }

  try {
    // Import the app secret as an HMAC key
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    // Compute HMAC-SHA256 of the payload portion (the raw base64url string)
    const expectedSignature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(encodedPayload),
    );

    // Decode the provided signature from base64url
    const receivedSignatureBytes = Uint8Array.from(
      atob(base64urlToBase64(encodedSignature)),
      (c) => c.charCodeAt(0),
    );

    // Timing-safe comparison
    if (!timingSafeEqual(expectedSignature, receivedSignatureBytes.buffer)) {
      return null;
    }

    // Signature valid — decode and return the payload
    const payloadJson = atob(base64urlToBase64(encodedPayload));
    return JSON.parse(payloadJson) as T;
  } catch {
    return null;
  }
}
