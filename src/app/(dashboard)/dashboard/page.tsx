import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getDashboardData } from "@/lib/dashboard/service";

export default async function DashboardPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  const result = await getDashboardData(db, userId);

  if (result.status !== "ok") {
    redirect("/accounts");
  }

  return <DashboardClient initialData={result.data} />;
}
