import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { users, threadsAccounts, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { getUserPlan, getAllUsageStats, getCurrentPeriod } from "@/lib/plans/limits";
import {
  SettingsClient,
  type SettingsAccountData,
  type SettingsUsageData,
} from "@/components/settings/settings-client";

export default async function SettingsPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  // Get user info
  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userRows[0];
  if (!user) redirect("/login");

  // Get subscription info
  const subRows = await db
    .select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  const subscription = subRows[0] ?? {
    plan: "free" as const,
    status: "active" as const,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };

  // Get connected Threads accounts
  const accountRows = await db
    .select({
      id: threadsAccounts.id,
      username: threadsAccounts.username,
      displayName: threadsAccounts.displayName,
      profilePictureUrl: threadsAccounts.profilePictureUrl,
      tokenExpiresAt: threadsAccounts.tokenExpiresAt,
    })
    .from(threadsAccounts)
    .where(eq(threadsAccounts.userId, userId));

  // Get usage data
  let usageData: SettingsUsageData | null = null;
  try {
    const [plan, usage] = await Promise.all([
      getUserPlan(db, userId),
      getAllUsageStats(db, userId),
    ]);
    const period = getCurrentPeriod();
    usageData = { plan, period, usage };
  } catch {
    // Usage data is non-critical, continue without it
  }

  const accountData: SettingsAccountData = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt.toISOString(),
    },
    subscription: {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd
        ? subscription.currentPeriodEnd.toISOString()
        : null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    },
    accounts: accountRows.map((acc) => ({
      ...acc,
      tokenExpiresAt: acc.tokenExpiresAt.toISOString(),
    })),
  };

  return <SettingsClient initialData={accountData} initialUsageData={usageData} />;
}
