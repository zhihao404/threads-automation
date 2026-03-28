import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Safely retrieve the Cloudflare environment bindings.
 * Returns `null` when running outside of a Cloudflare Workers context
 * (e.g. local `next dev` without wrangler).
 */
export async function getCfEnv() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env;
  } catch {
    return null;
  }
}
