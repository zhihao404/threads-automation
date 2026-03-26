"use client";

import { useState, useMemo, useCallback } from "react";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  format,
  startOfWeek,
  endOfWeek,
  parseISO,
} from "date-fns";
import { ja } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  Clock,
  Image,
  Video,
  Type,
  LayoutGrid,
  CalendarClock,
  XCircle,
  Trash2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { MonthView } from "./month-view";
import { WeekView } from "./week-view";
import { DayDetail } from "./day-detail";
import {
  RescheduleDialog,
  type ScheduledPost,
} from "./reschedule-dialog";

const mediaTypeConfig: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  TEXT: { label: "テキスト", icon: Type },
  IMAGE: { label: "画像", icon: Image },
  VIDEO: { label: "動画", icon: Video },
  CAROUSEL: { label: "カルーセル", icon: LayoutGrid },
};

const CHART_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

export interface CalendarViewProps {
  initialPosts?: ScheduledPost[];
}

type ViewMode = "month" | "week";

export function CalendarView({ initialPosts = [] }: CalendarViewProps) {
  const [posts, setPosts] = useState<ScheduledPost[]>(initialPosts);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [postDetailOpen, setPostDetailOpen] = useState(false);
  const [reschedulePost, setReschedulePost] = useState<ScheduledPost | null>(
    null
  );
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  // Build a stable color map for accounts
  const accountColorMap = useMemo(() => {
    const map = new Map<string, number>();
    const seen = new Set<string>();
    let colorIndex = 0;
    for (const post of posts) {
      if (!seen.has(post.accountId)) {
        seen.add(post.accountId);
        map.set(post.accountId, colorIndex % CHART_COLORS.length);
        colorIndex++;
      }
    }
    return map;
  }, [posts]);

  // Navigation
  const navigatePrev = useCallback(() => {
    if (viewMode === "month") {
      setCurrentDate((prev) => subMonths(prev, 1));
    } else {
      setCurrentDate((prev) => subWeeks(prev, 1));
    }
  }, [viewMode]);

  const navigateNext = useCallback(() => {
    if (viewMode === "month") {
      setCurrentDate((prev) => addMonths(prev, 1));
    } else {
      setCurrentDate((prev) => addWeeks(prev, 1));
    }
  }, [viewMode]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  }, []);

  // Title text for the header
  const headerTitle = useMemo(() => {
    if (viewMode === "month") {
      return format(currentDate, "yyyy年 M月", { locale: ja });
    }
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
    return `${format(weekStart, "M月d日", { locale: ja })} - ${format(weekEnd, "M月d日", { locale: ja })}`;
  }, [currentDate, viewMode]);

  // Post detail handlers
  const handleSelectPost = useCallback((post: ScheduledPost) => {
    setSelectedPost(post);
    setPostDetailOpen(true);
  }, []);

  const handleReschedule = useCallback((post: ScheduledPost) => {
    setReschedulePost(post);
    setRescheduleOpen(true);
    setPostDetailOpen(false);
  }, []);

  const handleRescheduled = useCallback(
    (postId: string, newDate: string) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, scheduledAt: newDate } : p
        )
      );
    },
    []
  );

  const handleCancelSchedule = useCallback(async (postId: string) => {
    if (!confirm("この投稿の予約をキャンセルしますか？")) return;

    try {
      const response = await fetch(`/api/posts/${postId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });

      if (response.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setPostDetailOpen(false);
      }
    } catch {
      alert("予約のキャンセルに失敗しました。");
    }
  }, []);

  const handleDelete = useCallback(async (postId: string) => {
    if (!confirm("この投稿を削除しますか？この操作は取り消せません。")) return;

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setPostDetailOpen(false);
      }
    } catch {
      alert("投稿の削除に失敗しました。");
    }
  }, []);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4">
        {/* Left: Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={navigatePrev}
            aria-label="前へ"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[160px] text-center">
            {headerTitle}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={navigateNext}
            aria-label="次へ"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            今日
          </Button>
        </div>

        {/* Right: View Toggle */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
        >
          <TabsList>
            <TabsTrigger value="month" className="gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">月表示</span>
            </TabsTrigger>
            <TabsTrigger value="week" className="gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">週表示</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Calendar Grid */}
        <div className="flex-1 rounded-lg border bg-card overflow-hidden">
          {viewMode === "month" ? (
            <MonthView
              currentDate={currentDate}
              selectedDate={selectedDate}
              posts={posts}
              accountColorMap={accountColorMap}
              onSelectDate={handleSelectDate}
            />
          ) : (
            <WeekView
              currentDate={currentDate}
              selectedDate={selectedDate}
              posts={posts}
              accountColorMap={accountColorMap}
              onSelectDate={handleSelectDate}
              onSelectPost={handleSelectPost}
            />
          )}
        </div>

        {/* Day Detail Panel (desktop only) */}
        <div className="hidden lg:flex w-80 rounded-lg border bg-card overflow-hidden">
          <DayDetail
            selectedDate={selectedDate}
            posts={posts}
            accountColorMap={accountColorMap}
            onReschedule={handleReschedule}
            onCancel={handleCancelSchedule}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* Mobile: Selected day posts (shown below calendar) */}
      <div className="lg:hidden mt-4">
        <div className="rounded-lg border bg-card overflow-hidden">
          <DayDetail
            selectedDate={selectedDate}
            posts={posts}
            accountColorMap={accountColorMap}
            onReschedule={handleReschedule}
            onCancel={handleCancelSchedule}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* Post Detail Dialog */}
      <PostDetailDialog
        post={selectedPost}
        open={postDetailOpen}
        onOpenChange={setPostDetailOpen}
        accountColorMap={accountColorMap}
        onReschedule={handleReschedule}
        onCancel={handleCancelSchedule}
        onDelete={handleDelete}
      />

      {/* Reschedule Dialog */}
      <RescheduleDialog
        post={reschedulePost}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        onRescheduled={handleRescheduled}
      />
    </div>
  );
}

// ----- Post Detail Dialog -----

interface PostDetailDialogProps {
  post: ScheduledPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountColorMap: Map<string, number>;
  onReschedule: (post: ScheduledPost) => void;
  onCancel: (postId: string) => void;
  onDelete: (postId: string) => void;
}

function PostDetailDialog({
  post,
  open,
  onOpenChange,
  accountColorMap,
  onReschedule,
  onCancel,
  onDelete,
}: PostDetailDialogProps) {
  if (!post) return null;

  const mediaInfo = mediaTypeConfig[post.mediaType] || mediaTypeConfig.TEXT;
  const MediaIcon = mediaInfo.icon;
  const colorIndex = accountColorMap.get(post.accountId) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>予約投稿の詳細</DialogTitle>
          <DialogDescription>
            予約された投稿の詳細情報です。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account */}
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              {post.accountProfilePicture && (
                <AvatarImage
                  src={post.accountProfilePicture}
                  alt={post.accountUsername}
                />
              )}
              <AvatarFallback className="text-xs">
                {post.accountUsername.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {post.accountDisplayName || post.accountUsername}
              </p>
              <p className="text-xs text-muted-foreground">
                @{post.accountUsername}
              </p>
            </div>
            <div
              className={cn(
                "h-3 w-3 rounded-full",
                CHART_COLORS[colorIndex]
              )}
            />
          </div>

          <Separator />

          {/* Schedule Info */}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">予約日時:</span>
            <span>
              {format(parseISO(post.scheduledAt), "yyyy年M月d日 (EEEE) HH:mm", {
                locale: ja,
              })}
            </span>
          </div>

          {/* Media Type */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-xs font-normal">
              <MediaIcon className="h-3 w-3" />
              {mediaInfo.label}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs font-normal bg-blue-100 text-blue-800 border-blue-200"
            >
              予約済み
            </Badge>
          </div>

          <Separator />

          {/* Content */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              投稿内容
            </p>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {post.content}
              </p>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => onReschedule(post)}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              リスケジュール
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => onCancel(post.id)}
            >
              <XCircle className="h-3.5 w-3.5" />
              予約キャンセル
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(post.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              削除
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
