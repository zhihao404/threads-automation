import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { AccountsClient, type AccountData } from "@/components/accounts/accounts-client";
import { listUserAccounts } from "@/lib/accounts/service";

export default async function AccountsPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  const accountsWithStatus: AccountData[] = await listUserAccounts(db, userId);

  return <AccountsClient initialAccounts={accountsWithStatus} />;
}
