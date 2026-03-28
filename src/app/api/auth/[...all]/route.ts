import { createAuth } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function getEnv() {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

export async function GET(request: Request) {
  const env = await getEnv();
  const auth = createAuth(env.DB, env.BETTER_AUTH_SECRET);
  return auth.handler(request);
}

export async function POST(request: Request) {
  const env = await getEnv();
  const auth = createAuth(env.DB, env.BETTER_AUTH_SECRET);
  return auth.handler(request);
}
