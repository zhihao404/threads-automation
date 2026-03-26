"use client";

import { useState } from "react";
import {
  Plus,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  ExternalLink,
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

interface Account {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  verified: boolean;
  tokenStatus: "active" | "expiring" | "expired";
  followers: number;
  connectedAt: string;
}

const placeholderAccounts: Account[] = [
  {
    id: "1",
    username: "threads_main",
    displayName: "Main Account",
    avatarUrl: "",
    verified: true,
    tokenStatus: "active",
    followers: 1829,
    connectedAt: "Connected 3 days ago",
  },
  {
    id: "2",
    username: "brand_official",
    displayName: "Brand Official",
    avatarUrl: "",
    verified: false,
    tokenStatus: "expiring",
    followers: 542,
    connectedAt: "Connected 2 weeks ago",
  },
];

function getTokenBadge(status: Account["tokenStatus"]) {
  switch (status) {
    case "active":
      return (
        <Badge
          variant="secondary"
          className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        >
          <CheckCircle2 className="h-3 w-3" />
          Active
        </Badge>
      );
    case "expiring":
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

export default function AccountsPage() {
  const [accounts] = useState<Account[]>(placeholderAccounts);

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
                    <AvatarImage src={account.avatarUrl} alt={account.displayName} />
                    <AvatarFallback>
                      {account.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        {account.displayName}
                      </CardTitle>
                      {account.verified && (
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
                    <DropdownMenuItem className="gap-2">
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
                    <p className="text-sm text-muted-foreground">
                      {account.followers.toLocaleString()} followers
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.connectedAt}
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
