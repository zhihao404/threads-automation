import { createAuth } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function getD1(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

export async function GET(request: Request) {
  const d1 = await getD1();
  const auth = createAuth(d1);
  return auth.handler(request);
}

export async function POST(request: Request) {
  const d1 = await getD1();
  const auth = createAuth(d1);
  return auth.handler(request);
}
