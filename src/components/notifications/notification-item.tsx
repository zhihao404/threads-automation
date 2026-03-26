"use client";

import { useCallback } from "react";
import {
  MessageCircle,
  AtSign,
  Send,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type NotificationType = "reply" | "mention" | "publish" | "delete";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  metadata: string | null;
  isRead: boolean;
  createdAt: string;
  accountUsername?: string;
}

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

const typeConfig: Record<
  NotificationType,
  {
    icon: typeof MessageCircle;
    color: string;
    bgColor: string;
  }
> = {
  reply: {
    icon: MessageCircle,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  mention: {
    icon: AtSign,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  publish: {
    icon: Send,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  delete: {
    icon: Trash2,
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
};

function parseMetadata(metadata: string | null): Record<string, unknown> | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getMetadataContext(
  type: NotificationType,
  metadata: string | null
): string | null {
  const parsed = parseMetadata(metadata);
  if (!parsed) return null;

  switch (type) {
    case "reply":
      return parsed.postContent
        ? `投稿: "${String(parsed.postContent).slice(0, 50)}..."`
        : null;
    case "mention":
      return parsed.mentionedBy
        ? `@${String(parsed.mentionedBy)} からのメンション`
        : null;
    case "publish":
      return parsed.scheduledTime
        ? `予約時刻: ${String(parsed.scheduledTime)}`
        : null;
    case "delete":
      return parsed.reason ? `理由: ${String(parsed.reason)}` : null;
    default:
      return null;
  }
}

export function NotificationItem({
  notification,
  onRead,
  onDelete,
  compact = false,
}: NotificationItemProps) {
  const config = typeConfig[notification.type];
  const Icon = config.icon;
  const metadataContext = getMetadataContext(
    notification.type,
    notification.metadata
  );

  const relativeTime = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: ja,
  });

  const handleClick = useCallback(() => {
    if (!notification.isRead) {
      onRead(notification.id);
    }
  }, [notification.id, notification.isRead, onRead]);

  const handleMarkRead = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRead(notification.id);
    },
    [notification.id, onRead]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(notification.id);
    },
    [notification.id, onDelete]
  );

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent",
          !notification.isRead && "bg-accent/50"
        )}
      >
        {/* Unread indicator */}
        <div className="mt-1.5 flex shrink-0 items-center">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              !notification.isRead ? "bg-primary" : "bg-transparent"
            )}
          />
        </div>

        {/* Icon */}
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            config.bgColor
          )}
        >
          <Icon className={cn("h-4 w-4", config.color)} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{notification.title}</p>
          {notification.body && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {notification.body}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{relativeTime}</p>
        </div>

        {/* Hover actions */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!notification.isRead && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleMarkRead}
              title="既読にする"
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            title="削除"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </button>
    );
  }

  // Full-size card for the notifications page
  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent/50",
        !notification.isRead && "border-primary/20 bg-primary/5"
      )}
    >
      {/* Unread indicator */}
      <div className="mt-2 flex shrink-0 items-center">
        <div
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            !notification.isRead ? "bg-primary" : "bg-transparent"
          )}
        />
      </div>

      {/* Icon */}
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          config.bgColor
        )}
      >
        <Icon className={cn("h-5 w-5", config.color)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm",
              !notification.isRead ? "font-semibold" : "font-medium"
            )}
          >
            {notification.title}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {relativeTime}
          </span>
        </div>
        {notification.body && (
          <p className="mt-1 text-sm text-muted-foreground">
            {notification.body}
          </p>
        )}
        {metadataContext && (
          <p className="mt-1.5 text-xs text-muted-foreground/80">
            {metadataContext}
          </p>
        )}
        {notification.accountUsername && (
          <p className="mt-1 text-xs text-muted-foreground">
            @{notification.accountUsername}
          </p>
        )}
      </div>

      {/* Hover actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {!notification.isRead && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleMarkRead}
            title="既読にする"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          title="削除"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </button>
  );
}
