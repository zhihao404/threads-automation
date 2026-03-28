"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface AccountData {
  id: string;
  threadsUserId: string;
  username: string;
  displayName: string | null;
  profilePictureUrl: string | null;
  biography: string | null;
  isVerified: boolean;
  tokenStatus: "valid" | "expiring_soon" | "expired";
  tokenExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

function getTokenBadge(status: AccountData["tokenStatus"]) {
  switch (status) {
    case "valid":
      return (
        <Badge
          variant="secondary"
          className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        >
          <CheckCircle2 className="h-3 w-3" />
          Active
        </Badge>
      );
    case "expiring_soon":
      return (
        <Badge
          variant="secondary"
          className="gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
        >
          <AlertCircle className="h-3 w-3" />
          Expiring soon
        </Badge>
      );
    case "expired":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Expired
        </Badge>
      );
  }
}

function formatConnectedDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Connected today";
  if (diffDays === 1) return "Connected 1 day ago";
  if (diffDays < 7) return `Connected ${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `Connected ${weeks} week${weeks > 1 ? "s" : ""} ago`;
  }
  const months = Math.floor(diffDays / 30);
  return `Connected ${months} month${months > 1 ? "s" : ""} ago`;
}

interface AccountsClientProps {
  initialAccounts: AccountData[];
}

export function AccountsClient({ initialAccounts }: AccountsClientProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Accounts</h2>
              <p className="text-muted-foreground">
                Manage your connected Threads accounts.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      }
    >
      <AccountsClientContent initialAccounts={initialAccounts} />
    </Suspense>
  );
}

function AccountsClientContent({ initialAccounts }: AccountsClientProps) {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const urlSuccess = searchParams.get("success");

  const [accounts] = useState<AccountData[]>(initialAccounts);
  const [dismissedError, setDismissedError] = useState(false);
  const [dismissedSuccess, setDismissedSuccess] = useState(false);

  function dismissAlert(type: "error" | "success") {
    if (type === "error") setDismissedError(true);
    else setDismissedSuccess(true);

    // Remove the query param from the URL without a navigation
    const url = new URL(window.location.href);
    url.searchParams.delete(type);
    window.history.replaceState({}, "", url.toString());
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Accounts</h2>
          <p className="text-muted-foreground">
            Manage your connected Threads accounts.
          </p>
        </div>
        <Button asChild className="gap-2">
          <a href="/api/threads/connect">
            <Plus className="h-4 w-4" />
            Connect Threads Account
          </a>
        </Button>
      </div>

      {/* URL query param alerts */}
      {urlError && !dismissedError && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{decodeURIComponent(urlError)}</span>
          <button
            type="button"
            onClick={() => dismissAlert("error")}
            className="shrink-0 rounded-md p-1 hover:bg-red-100 dark:hover:bg-red-900/50"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {urlSuccess && !dismissedSuccess && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">{decodeURIComponent(urlSuccess)}</span>
          <button
            type="button"
            onClick={() => dismissAlert("success")}
            className="shrink-0 rounded-md p-1 hover:bg-green-100 dark:hover:bg-green-900/50"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Account list */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No accounts connected</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your first Threads account to get started.
            </p>
            <Button asChild className="mt-4 gap-2">
              <a href="/api/threads/connect">
                <Plus className="h-4 w-4" />
                Connect Account
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={account.profilePictureUrl ?? undefined} alt={account.displayName ?? account.username} />
                    <AvatarFallback>
                      {(account.displayName ?? account.username).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        {account.displayName ?? account.username}
                      </CardTitle>
                      {account.isVerified && (
                        <CheckCircle2 className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <CardDescription>@{account.username}</CardDescription>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="gap-2"
                      onClick={() =>
                        window.open(
                          `https://www.threads.net/@${account.username}`,
                          "_blank"
                        )
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                      View on Threads
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Refresh token
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4" />
                      Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {formatConnectedDate(account.createdAt)}
                    </p>
                  </div>
                  {getTokenBadge(account.tokenStatus)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
