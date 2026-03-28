import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { PostsClient } from "@/components/posts/posts-client";
import { listUserPosts } from "@/lib/posts/service";

export default async function PostsPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  const { posts, total } = await listUserPosts(db, {
    userId,
    limit: 50,
  });

  return <PostsClient initialPosts={posts} initialTotal={total} />;
}
