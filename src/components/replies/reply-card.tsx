"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import {
  ExternalLink,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ReplyItem {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  permalink?: string;
  hideStatus: string;
  parentPost: {
    id: string;
    threadsMediaId: string;
    content: string;
  };
}

export interface ReplyCardProps {
  reply: ReplyItem;
  onToggleHide: (id: string, hide: boolean) => Promise<void>;
  accountId: string;
}

function isHidden(status: string): boolean {
  return status === "HIDDEN" || status === "COVERED";
}

function formatRelativeTime(timestamp: string): string {
  try {
    return formatDistanceToNow(new Date(timestamp), {
      addSuffix: true,
      locale: ja,
    });
  } catch {
    return "";
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function ReplyCard({ reply, onToggleHide, accountId }: ReplyCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showParent, setShowParent] = useState(false);
  const [localHideStatus, setLocalHideStatus] = useState(reply.hideStatus);

  const hidden = isHidden(localHideStatus);
  const firstLetter = (reply.username?.[0] ?? "?").toUpperCase();

  const handleToggleHide = async () => {
    const newHide = !hidden;
    // Optimistic update
    setLocalHideStatus(newHide ? "HIDDEN" : "NOT_HUSHED");
    setIsLoading(true);

    try {
      await onToggleHide(reply.id, newHide);
    } catch {
      // Revert on failure
      setLocalHideStatus(hidden ? "HIDDEN" : "NOT_HUSHED");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={cn("transition-shadow hover:shadow-md", hidden && "opacity-70")}>
      <CardContent className="p-5">
        {/* Reply author + status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar placeholder */}
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-muted-foreground">
                {firstLetter}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-sm font-medium truncate block">
                @{reply.username}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(reply.timestamp)}
              </span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-normal shrink-0",
              hidden
                ? "bg-red-100 text-red-800 border-red-200"
                : "bg-green-100 text-green-800 border-green-200"
            )}
          >
            {hidden ? "非表示" : "表示中"}
          </Badge>
        </div>

        {/* Reply text */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3">
          {reply.text}
        </p>

        {/* Parent post reference (collapsible) */}
        <div className="mb-3">
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowParent(!showParent)}
          >
            <MessageSquare className="h-3 w-3" />
            <span>元の投稿</span>
            {showParent ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          {showParent && (
            <div className="mt-2 p-3 bg-muted/50 rounded-md text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {truncateText(reply.parentPost.content, 200)}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            {new Date(reply.timestamp).toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="flex items-center gap-1">
            {reply.permalink && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                asChild
              >
                <a
                  href={reply.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Threadsで見る
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 text-xs",
                hidden
                  ? "text-green-700 hover:text-green-800 hover:bg-green-50"
                  : "text-red-700 hover:text-red-800 hover:bg-red-50"
              )}
              onClick={handleToggleHide}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : hidden ? (
                <Eye className="h-3.5 w-3.5 mr-1" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 mr-1" />
              )}
              {hidden ? "表示する" : "非表示にする"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
