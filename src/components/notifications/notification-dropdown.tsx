"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  NotificationItem,
  type Notification,
} from "@/components/notifications/notification-item";

interface NotificationDropdownProps {
  notifications: Notification[];
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function NotificationDropdown({
  notifications,
  isLoading,
  onMarkAsRead,
  onMarkAllRead,
  onDelete,
  onClose,
}: NotificationDropdownProps) {
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAllRead(true);
    try {
      onMarkAllRead();
    } finally {
      setMarkingAllRead(false);
    }
  }, [onMarkAllRead]);

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <div className="flex w-[380px] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold">通知</h3>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleMarkAllRead}
            disabled={markingAllRead}
          >
            {markingAllRead ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            すべて既読
          </Button>
        )}
      </div>

      <Separator />

      {/* Notification list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
          <Bell className="h-8 w-8 opacity-50" />
          <p className="text-sm">通知はありません</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="flex flex-col">
            {notifications.slice(0, 10).map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={onMarkAsRead}
                onDelete={onDelete}
                compact
              />
            ))}
          </div>
        </ScrollArea>
      )}

      <Separator />

      {/* Footer */}
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground hover:text-foreground"
          asChild
          onClick={onClose}
        >
          <Link href="/notifications">すべて表示</Link>
        </Button>
      </div>
    </div>
  );
}
