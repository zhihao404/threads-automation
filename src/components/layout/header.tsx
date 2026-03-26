"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "@/components/notifications/notification-bell";

interface HeaderProps {
  onMenuClick: () => void;
}

interface AccountInfo {
  id: string;
  username: string;
  displayName: string | null;
  profilePictureUrl: string | null;
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/posts": "Posts",
  "/posts/new": "New Post",
  "/posts/schedule": "Schedule",
  "/posts/templates": "Templates",
  "/ai/generate": "AI Generate",
  "/dashboard/analytics": "Analytics",
  "/replies": "Replies",
  "/accounts": "Accounts",
  "/settings": "Settings",
  "/notifications": "Notifications",
};

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok) return;
        const data: {
          accounts?: Array<{
            id: string;
            username: string;
            displayName: string | null;
            profilePictureUrl: string | null;
          }>;
        } = await res.json();
        setAccounts(data.accounts ?? []);
      } catch {
        // Silently fail - header will show fallback
      }
    }
    fetchAccounts();
  }, []);

  const primaryAccount = accounts.length > 0 ? accounts[0] : null;
  const displayUsername = primaryAccount
    ? `@${primaryAccount.username}`
    : "未接続";
  const avatarFallback = primaryAccount
    ? primaryAccount.username.slice(0, 2).toUpperCase()
    : "--";

  const pageTitle =
    pageTitles[pathname] ||
    pathname
      .split("/")
      .pop()
      ?.replace(/-/g, " ")
      ?.replace(/\b\w/g, (l) => l.toUpperCase()) ||
    "Dashboard";

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      {/* Page title / breadcrumb */}
      <div className="flex-1">
        <h1 className="text-lg font-semibold">{pageTitle}</h1>
      </div>

      {/* Account switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage
                src={primaryAccount?.profilePictureUrl ?? undefined}
                alt="Account"
              />
              <AvatarFallback className="text-[10px]">
                {avatarFallback}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{displayUsername}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {accounts.length > 0 ? (
            accounts.map((acc) => (
              <DropdownMenuItem key={acc.id}>
                <Avatar className="mr-2 h-5 w-5">
                  <AvatarImage src={acc.profilePictureUrl ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {acc.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                @{acc.username}
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              アカウント未接続
            </DropdownMenuItem>
          )}
          <Separator className="my-1" />
          <DropdownMenuItem asChild>
            <a href="/accounts">Manage accounts</a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notification bell */}
      <NotificationBell />
    </header>
  );
}
