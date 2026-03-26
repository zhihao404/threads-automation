"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  MoreHorizontal,
  Pencil,
  Copy,
  Send,
  Trash2,
  Type,
  Image,
  Video,
  LayoutGrid,
  Braces,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { extractVariables } from "@/lib/templates/render";

export interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    content: string;
    category: string | null;
    mediaType: string;
    createdAt: string;
    updatedAt: string;
  };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onUse: (id: string) => void;
}

const mediaTypeConfig: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  TEXT: { label: "テキスト", icon: Type },
  IMAGE: { label: "画像", icon: Image },
  VIDEO: { label: "動画", icon: Video },
  CAROUSEL: { label: "カルーセル", icon: LayoutGrid },
};

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return format(date, "yyyy/MM/dd HH:mm", { locale: ja });
  } catch {
    return "";
  }
}

/**
 * Render template content preview with variables highlighted.
 */
function ContentPreview({ content }: { content: string }) {
  const maxLen = 100;
  const truncated = content.length > maxLen ? content.slice(0, maxLen) + "..." : content;

  // Split by variable pattern and render with highlights
  const parts = truncated.split(/(\{\{\w+\}\})/g);

  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (/^\{\{\w+\}\}$/.test(part)) {
          return (
            <span
              key={i}
              className="text-xs font-mono bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded px-1 py-0.5"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

export function TemplateCard({
  template,
  onEdit,
  onDelete,
  onDuplicate,
  onUse,
}: TemplateCardProps) {
  const mediaInfo = mediaTypeConfig[template.mediaType] || mediaTypeConfig.TEXT;
  const MediaIcon = mediaInfo.icon;
  const variables = extractVariables(template.content);

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        {/* Header: Name + Actions */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-sm leading-tight truncate">
            {template.name}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">メニュー</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(template.id)}>
                <Pencil className="h-4 w-4 mr-2" />
                編集
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(template.id)}>
                <Copy className="h-4 w-4 mr-2" />
                複製
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onUse(template.id)}>
                <Send className="h-4 w-4 mr-2" />
                このテンプレートで投稿
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(template.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Badges Row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge variant="outline" className="text-xs gap-1 font-normal">
            <MediaIcon className="h-3 w-3" />
            {mediaInfo.label}
          </Badge>
          {template.category && (
            <Badge variant="secondary" className="text-xs font-normal">
              {template.category}
            </Badge>
          )}
          {variables.length > 0 && (
            <Badge variant="outline" className="text-xs gap-1 font-normal text-blue-600 border-blue-200">
              <Braces className="h-3 w-3" />
              {variables.length} 変数
            </Badge>
          )}
        </div>

        {/* Content Preview */}
        <div className="mb-3">
          <ContentPreview content={template.content} />
        </div>

        {/* Footer: Updated date */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
          <Clock className="h-3 w-3" />
          {formatDate(template.updatedAt)}
        </div>
      </CardContent>
    </Card>
  );
}
