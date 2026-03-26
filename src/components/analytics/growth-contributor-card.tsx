"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface GrowthContributorCardProps {
  postId: string;
  content: string;
  publishedAt: string;
  gain: number;
  followersBefore: number;
  followersAfter: number;
}

export function GrowthContributorCard({
  postId,
  content,
  publishedAt,
  gain,
  followersBefore,
  followersAfter,
}: GrowthContributorCardProps) {
  const truncatedContent =
    content.length > 100 ? content.slice(0, 100) + "..." : content;

  let formattedDate: string;
  try {
    formattedDate = format(parseISO(publishedAt), "M月d日 HH:mm", {
      locale: ja,
    });
  } catch {
    formattedDate = publishedAt;
  }

  return (
    <Link href={`/posts?highlight=${postId}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed text-foreground line-clamp-2">
                {truncatedContent}
              </p>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{formattedDate}</span>
                <span>
                  {followersBefore.toLocaleString()} → {followersAfter.toLocaleString()}
                </span>
              </div>
            </div>
            <Badge
              variant="secondary"
              className="shrink-0 gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            >
              <TrendingUp className="h-3 w-3" />
              +{gain}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
