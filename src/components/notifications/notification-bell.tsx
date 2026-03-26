"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import type { Notification } from "@/components/notifications/notification-item";
import { cn } from "@/lib/utils";

const POLL_INTERVAL = 30_000; // 30 seconds

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const hasFetchedNotifications = useRef(false);

  // Poll for unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/count");
      if (res.ok) {
        const data = (await res.json()) as { unreadCount: number };
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  // Fetch recent notifications for the dropdown
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (res.ok) {
        const data = (await res.json()) as { notifications: Notification[] };
        setNotifications(data.notifications);
        // Also update unread count from the fresh data
        const unread = data.notifications.filter((n) => !n.isRead).length;
        setUnreadCount((prev) => Math.max(prev, unread));
      }
    } catch {
      // Silently ignore errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set up polling for unread count
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen && !hasFetchedNotifications.current) {
      hasFetchedNotifications.current = true;
      fetchNotifications();
    }
    if (!isOpen) {
      hasFetchedNotifications.current = false;
    }
  }, [isOpen, fetchNotifications]);

  // Mark a single notification as read (optimistic)
  const handleMarkAsRead = useCallback(
    async (id: string) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [id] }),
        });
        if (!res.ok) {
          // Revert on failure
          fetchNotifications();
          fetchUnreadCount();
        }
      } catch {
        // Revert on failure
        fetchNotifications();
        fetchUnreadCount();
      }
    },
    [fetchNotifications, fetchUnreadCount]
  );

  // Mark all as read (optimistic)
  const handleMarkAllRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (!res.ok) {
        fetchNotifications();
        fetchUnreadCount();
      }
    } catch {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [fetchNotifications, fetchUnreadCount]);

  // Delete a notification (optimistic)
  const handleDelete = useCallback(
    async (id: string) => {
      const notification = notifications.find((n) => n.id === id);
      // Optimistic update
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (notification && !notification.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      try {
        const res = await fetch(`/api/notifications/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          fetchNotifications();
          fetchUnreadCount();
        }
      } catch {
        fetchNotifications();
        fetchUnreadCount();
      }
    },
    [notifications, fetchNotifications, fetchUnreadCount]
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute flex items-center justify-center rounded-full bg-destructive text-destructive-foreground",
                unreadCount > 9
                  ? "right-0.5 top-0.5 h-4 min-w-4 px-1 text-[10px] font-bold"
                  : "right-1 top-1 h-4 w-4 text-[10px] font-bold"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          <span className="sr-only">通知</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-auto p-0"
      >
        <NotificationDropdown
          notifications={notifications}
          isLoading={isLoading}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllRead={handleMarkAllRead}
          onDelete={handleDelete}
          onClose={handleClose}
        />
      </PopoverContent>
    </Popover>
  );
}
