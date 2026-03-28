import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { threadsAccounts, reports } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import {
  ReportsClient,
  type ReportsThreadsAccount,
  type ReportListItem,
} from "@/components/reports/reports-client";

export default async function ReportsPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  // Fetch accounts
  const accountRows = await db
    .select({
      id: threadsAccounts.id,
      username: threadsAccounts.username,
      displayName: threadsAccounts.displayName,
    })
    .from(threadsAccounts)
    .where(eq(threadsAccounts.userId, userId));

  const accounts: ReportsThreadsAccount[] = accountRows;

  if (accounts.length === 0) {
    return (
      <ReportsClient
        initialAccounts={[]}
        initialReports={[]}
        initialSelectedAccountId=""
      />
    );
  }

  const selectedAccountId = accounts[0]!.id;

  // Fetch reports for the first account
  const accountIds = [selectedAccountId];
  const accountInClause = sql`${reports.accountId} IN (${sql.join(
    accountIds.map((id) => sql`${id}`),
    sql`, `
  )})`;

  const reportRows = await db
    .select({
      id: reports.id,
      accountId: reports.accountId,
      type: reports.type,
      title: reports.title,
      periodStart: reports.periodStart,
      periodEnd: reports.periodEnd,
      summary: reports.summary,
      status: reports.status,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(accountInClause)
    .orderBy(desc(reports.createdAt))
    .limit(20);

  const initialReports: ReportListItem[] = reportRows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <ReportsClient
      initialAccounts={accounts}
      initialReports={initialReports}
      initialSelectedAccountId={selectedAccountId}
    />
  );
}
