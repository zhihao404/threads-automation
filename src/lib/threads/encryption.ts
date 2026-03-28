// =============================================================================
// Token Encryption / Decryption for Next.js App
// Wraps the shared crypto core with getCloudflareContext for key resolution
// =============================================================================

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  encryptTokenWithKey,
  decryptTokenWithKey,
} from "@/lib/crypto/core";

/**
 * Gets the encryption key from the Cloudflare environment.
 * Falls back to the provided key parameter if specified.
 */
async function getEncryptionKey(key?: string): Promise<string> {
  if (key) return key;

  const { env } = await getCloudflareContext({ async: true });
  const envKey = env.ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error("ENCRYPTION_KEY environment variable is not configured");
  }
  return envKey;
}

/**
 * Encrypts a token string using AES-256-GCM.
 *
 * Output format: base64(salt + iv + ciphertext)
 * - salt: 16 bytes (used for key derivation)
 * - iv: 12 bytes (initialization vector)
 * - ciphertext: variable length (includes GCM auth tag)
 *
 * @param token - The plaintext token to encrypt
 * @param key - Optional encryption passphrase. If omitted, reads ENCRYPTION_KEY from env.
 * @returns Base64-encoded encrypted string
 */
export async function encryptToken(token: string, key?: string): Promise<string> {
  const encryptionKey = await getEncryptionKey(key);
  return encryptTokenWithKey(token, encryptionKey);
}

/**
 * Decrypts a token that was encrypted with `encryptToken`.
 *
 * @param encrypted - Base64-encoded encrypted string
 * @param key - Optional encryption passphrase. If omitted, reads ENCRYPTION_KEY from env.
 * @returns The decrypted plaintext token
 * @throws Error if decryption fails (wrong key or corrupted data)
 */
export async function decryptToken(encrypted: string, key?: string): Promise<string> {
  const encryptionKey = await getEncryptionKey(key);
  return decryptTokenWithKey(encrypted, encryptionKey);
}
