"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PublishedPost {
  id: string;
  threadsMediaId: string | null;
  content: string;
}

interface PostFilterProps {
  accountId: string;
  value: string;
  onChange: (postId: string) => void;
}

function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "...";
}

export function PostFilter({ accountId, value, onChange }: PostFilterProps) {
  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!accountId) {
      setPublishedPosts([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    async function fetchPosts() {
      try {
        const params = new URLSearchParams({
          status: "published",
          accountId,
          limit: "50",
        });
        const response = await fetch(`/api/posts?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to fetch posts");

        const data = (await response.json()) as {
          posts: Array<{
            id: string;
            threadsMediaId: string | null;
            content: string;
          }>;
        };

        if (!cancelled) {
          setPublishedPosts(
            data.posts
              .filter((p) => p.threadsMediaId)
              .map((p) => ({
                id: p.id,
                threadsMediaId: p.threadsMediaId,
                content: p.content,
              }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch published posts:", err);
        if (!cancelled) {
          setPublishedPosts([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchPosts();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return (
    <Select value={value} onValueChange={onChange} disabled={isLoading}>
      <SelectTrigger className="w-full sm:w-[280px]">
        <SelectValue placeholder={isLoading ? "読み込み中..." : "投稿を選択"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">すべての投稿</SelectItem>
        {publishedPosts.map((post) => (
          <SelectItem key={post.id} value={post.threadsMediaId!}>
            <span className="truncate block max-w-[240px]">
              {truncateContent(post.content, 40)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
