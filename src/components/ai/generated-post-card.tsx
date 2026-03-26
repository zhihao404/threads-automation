"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Check,
  Copy,
  RefreshCw,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { GeneratedPost } from "@/lib/ai/generate";

interface GeneratedPostCardProps {
  post: GeneratedPost;
  index: number;
  onUse: (post: GeneratedPost) => void;
  onCopy: (content: string) => void;
  onImprove: (post: GeneratedPost) => void;
  onRegenerate: (index: number) => void;
  isRegenerating?: boolean;
}

export function GeneratedPostCard({
  post,
  index,
  onUse,
  onCopy,
  onImprove,
  onRegenerate,
  isRegenerating,
}: GeneratedPostCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(post.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const charWarning = post.charCount > 480;
  const charDanger = post.charCount > 500;

  return (
    <Card className="group relative">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            候補 {index + 1}
          </span>
          <span
            className={cn(
              "text-xs tabular-nums",
              charDanger
                ? "text-red-500 font-semibold"
                : charWarning
                  ? "text-yellow-600"
                  : "text-muted-foreground"
            )}
          >
            {post.charCount}/500
          </span>
        </div>

        {/* Content */}
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {post.content}
        </p>

        {/* Topic Tag */}
        {post.topicTag && (
          <div>
            <Badge variant="secondary" className="text-xs">
              #{post.topicTag}
            </Badge>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => onUse(post)}
            className="gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            使用する
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="gap-1.5"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "コピー済み" : "コピー"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRegenerate(index)}
            disabled={isRegenerating}
            className="gap-1.5"
          >
            {isRegenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            再生成
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onImprove(post)}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            改善
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
