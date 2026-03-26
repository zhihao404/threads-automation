"use client";

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
              <AvatarImage src="" alt="Account" />
              <AvatarFallback className="text-[10px]">TA</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">@threads_account</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem>
            <Avatar className="mr-2 h-5 w-5">
              <AvatarFallback className="text-[10px]">TA</AvatarFallback>
            </Avatar>
            @threads_account
          </DropdownMenuItem>
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
