import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { threadsAccounts } from "@/db/schema";
import {
  getTokenStatus,
  type AccountTokenStatus,
} from "@/lib/accounts/status";

export interface UserAccountSummary {
  id: string;
  threadsUserId: string;
  username: string;
  displayName: string | null;
  profilePictureUrl: string | null;
  biography: string | null;
  isVerified: boolean;
  tokenStatus: AccountTokenStatus;
  tokenExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export async function listUserAccounts(
  db: Database,
  userId: string,
): Promise<UserAccountSummary[]> {
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

  return accounts.map((account) => ({
    ...account,
    tokenStatus: getTokenStatus(account.tokenExpiresAt),
    tokenExpiresAt: account.tokenExpiresAt.toISOString(),
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }));
}
