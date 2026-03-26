"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Loader2,
  CheckCheck,
  MessageCircle,
  AtSign,
  Inbox,
} from "lucide-react";
import {
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NotificationItem,
  type Notification,
  type NotificationType,
} from "@/components/notifications/notification-item";

type FilterTab = "all" | "reply" | "mention" | "other";

const ITEMS_PER_PAGE = 20;

interface DateGroup {
  label: string;
  notifications: Notification[];
}

function groupByDate(notifications: Notification[]): DateGroup[] {
  const groups: Record<string, Notification[]> = {
    今日: [],
    昨日: [],
    今週: [],
    今月: [],
    それ以前: [],
  };

  for (const notification of notifications) {
    const date = new Date(notification.createdAt);
    if (isToday(date)) {
      groups["今日"].push(notification);
    } else if (isYesterday(date)) {
      groups["昨日"].push(notification);
    } else if (isThisWeek(date)) {
      groups["今週"].push(notification);
    } else if (isThisMonth(date)) {
      groups["今月"].push(notification);
    } else {
      groups["それ以前"].push(notification);
    }
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, notifications: items }));
}

function filterNotifications(
  notifications: Notification[],
  filter: FilterTab
): Notification[] {
  if (filter === "all") return notifications;
  if (filter === "other") {
    return notifications.filter(
      (n) => n.type !== "reply" && n.type !== "mention"
    );
  }
  return notifications.filter((n) => n.type === filter);
}

function getEmptyMessage(filter: FilterTab): string {
  switch (filter) {
    case "all":
      return "通知はありません";
    case "reply":
      return "リプライの通知はありません";
    case "mention":
      return "メンションの通知はありません";
    case "other":
      return "その他の通知はありません";
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (offset = 0) => {
      const isInitial = offset === 0;
      if (isInitial) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const res = await fetch(
          `/api/notifications?limit=${ITEMS_PER_PAGE}&offset=${offset}`
        );
        if (res.ok) {
          const data = (await res.json()) as {
            notifications: Notification[];
          };
          if (isInitial) {
            setNotifications(data.notifications);
          } else {
            setNotifications((prev) => [...prev, ...data.notifications]);
          }
          setHasMore(data.notifications.length >= ITEMS_PER_PAGE);
        }
      } catch {
        // Error fetching
      } finally {
        if (isInitial) {
          setIsLoading(false);
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    []
  );

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/count");
      if (res.ok) {
        const data = (await res.json()) as { unreadCount: number };
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // Error fetching
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // Load more
  const handleLoadMore = useCallback(() => {
    fetchNotifications(notifications.length);
  }, [fetchNotifications, notifications.length]);

  // Mark single as read (optimistic)
  const handleMarkAsRead = useCallback(
    async (id: string) => {
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
          fetchNotifications();
          fetchUnreadCount();
        }
      } catch {
        fetchNotifications();
        fetchUnreadCount();
      }
    },
    [fetchNotifications, fetchUnreadCount]
  );

  // Mark all as read (optimistic)
  const handleMarkAllRead = useCallback(async () => {
    setMarkingAllRead(true);
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
    } finally {
      setMarkingAllRead(false);
    }
  }, [fetchNotifications, fetchUnreadCount]);

  // Delete notification (optimistic)
  const handleDelete = useCallback(
    async (id: string) => {
      const notification = notifications.find((n) => n.id === id);
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

  const filtered = filterNotifications(notifications, activeTab);
  const dateGroups = groupByDate(filtered);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">通知</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount}件の未読
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAllRead}
          disabled={markingAllRead || unreadCount === 0}
          className="gap-2"
        >
          {markingAllRead ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="h-4 w-4" />
          )}
          すべて既読にする
        </Button>
      </div>

      {/* Filter tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as FilterTab)}
      >
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            すべて
          </TabsTrigger>
          <TabsTrigger value="reply" className="gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" />
            リプライ
          </TabsTrigger>
          <TabsTrigger value="mention" className="gap-1.5">
            <AtSign className="h-3.5 w-3.5" />
            メンション
          </TabsTrigger>
          <TabsTrigger value="other" className="gap-1.5">
            <Inbox className="h-3.5 w-3.5" />
            その他
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <NotificationsSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState message={getEmptyMessage(activeTab)} />
          ) : (
            <div className="flex flex-col gap-6">
              {dateGroups.map((group) => (
                <div key={group.label}>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-muted-foreground">
                      {group.label}
                    </h2>
                    <Separator className="flex-1" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {group.notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onRead={handleMarkAsRead}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center py-4">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="gap-2"
                  >
                    {isLoadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {isLoadingMore ? "読み込み中..." : "さらに読み込む"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-muted-foreground">
      <Bell className="h-12 w-12 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 rounded-lg border p-4">
          <Skeleton className="h-2.5 w-2.5 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
