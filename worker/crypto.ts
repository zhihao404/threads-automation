// =============================================================================
// Worker-compatible Token Encryption / Decryption
// Same algorithm as src/lib/threads/encryption.ts but without
// getCloudflareContext (the worker passes the key directly)
// =============================================================================

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const SALT_LENGTH = 16;

/**
 * Converts a Uint8Array to a base64 string using a chunked approach
 * to avoid "Maximum call stack size exceeded" with large payloads.
 * Uses Web APIs only (no Node.js Buffer) for Cloudflare Workers compatibility.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Derives a CryptoKey from a passphrase string using PBKDF2.
 */
async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Decrypts a token that was encrypted with AES-256-GCM.
 * Requires the encryption key to be passed explicitly.
 *
 * @param encrypted - Base64-encoded encrypted string
 * @param key - Encryption passphrase (from env.ENCRYPTION_KEY)
 * @returns The decrypted plaintext token
 */
export async function decryptTokenWithKey(
  encrypted: string,
  key: string,
): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  if (combined.length < SALT_LENGTH + IV_LENGTH + 1) {
    throw new Error("Invalid encrypted token: data too short");
  }

  const salt = combined.slice(0, SALT_LENGTH) as Uint8Array<ArrayBuffer>;
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

  const cryptoKey = await deriveKey(key, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv as BufferSource },
    cryptoKey,
    ciphertext as BufferSource,
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Encrypts a token string using AES-256-GCM.
 * Requires the encryption key to be passed explicitly.
 *
 * @param token - The plaintext token to encrypt
 * @param key - Encryption passphrase (from env.ENCRYPTION_KEY)
 * @returns Base64-encoded encrypted string
 */
export async function encryptTokenWithKey(
  token: string,
  key: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const cryptoKey = await deriveKey(key, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv as BufferSource },
    cryptoKey,
    encoder.encode(token),
  );

  // Combine salt + iv + ciphertext into a single buffer
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return uint8ArrayToBase64(combined);
}
