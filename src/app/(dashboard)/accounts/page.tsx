import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { threadsAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { AccountsClient, type AccountData } from "@/components/accounts/accounts-client";

function getTokenStatus(
  expiresAt: Date
): "valid" | "expiring_soon" | "expired" {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  if (expiresAt < now) {
    return "expired";
  }
  if (expiresAt < threeDaysFromNow) {
    return "expiring_soon";
  }
  return "valid";
}

export default async function AccountsPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  const accounts = await db
    .select({
      id: threadsAccounts.id,
      threadsUserId: threadsAccounts.threadsUserId,
      username: threadsAccounts.username,
      displayName: threadsAccounts.displayName,
      profilePictureUrl: threadsAccounts.profilePictureUrl,
      biography: threadsAccounts.biography,
      isVerified: threadsAccounts.isVerified,
      tokenExpiresAt: threadsAccounts.tokenExpiresAt,
      createdAt: threadsAccounts.createdAt,
      updatedAt: threadsAccounts.updatedAt,
    })
    .from(threadsAccounts)
    .where(eq(threadsAccounts.userId, userId));

  const accountsWithStatus: AccountData[] = accounts.map((account) => ({
    ...account,
    tokenStatus: getTokenStatus(account.tokenExpiresAt),
    tokenExpiresAt: account.tokenExpiresAt.toISOString(),
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }));

  return <AccountsClient initialAccounts={accountsWithStatus} />;
}
