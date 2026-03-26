"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VariableInserter } from "@/components/templates/variable-inserter";
import {
  extractVariables,
  renderTemplate,
  getBuiltinVariableValues,
} from "@/lib/templates/render";
import { Loader2, Eye, Braces } from "lucide-react";

type MediaType = "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";

interface TemplateData {
  id: string;
  name: string;
  content: string;
  category: string | null;
  mediaType: string;
  createdAt: string;
  updatedAt: string;
}

interface TemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  template?: TemplateData | null;
  categories: string[];
  onSave: (data: {
    name: string;
    content: string;
    category?: string;
    mediaType: MediaType;
  }) => Promise<void>;
}

export function TemplateEditor({
  open,
  onOpenChange,
  mode,
  template,
  categories,
  onSave,
}: TemplateEditorProps) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("TEXT");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset form when template or mode changes
  useEffect(() => {
    if (open) {
      if (mode === "edit" && template) {
        setName(template.name);
        setContent(template.content);
        setCategory(template.category || "");
        setMediaType(template.mediaType as MediaType);
      } else {
        setName("");
        setContent("");
        setCategory("");
        setMediaType("TEXT");
      }
      setErrors({});
      setShowPreview(false);
    }
  }, [open, mode, template]);

  const handleInsertVariable = useCallback((variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + variable);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    setContent((prev) => {
      const newContent = prev.substring(0, start) + variable + prev.substring(end);
      // Restore cursor position after React re-renders
      setTimeout(() => {
        textarea.focus();
        const newPos = start + variable.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
      return newContent;
    });
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "テンプレート名を入力してください";
    } else if (name.length > 100) {
      newErrors.name = "テンプレート名は100文字以内で入力してください";
    }

    if (!content.trim()) {
      newErrors.content = "テンプレート内容を入力してください";
    } else if (content.length > 500) {
      newErrors.content = "テンプレート内容は500文字以内で入力してください";
    }

    if (category && category.length > 50) {
      newErrors.category = "カテゴリは50文字以内で入力してください";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        content: content,
        category: category.trim() || undefined,
        mediaType,
      });
      onOpenChange(false);
    } catch {
      setErrors({ form: "保存に失敗しました。もう一度お試しください。" });
    } finally {
      setIsSaving(false);
    }
  };

  const variables = extractVariables(content);
  const builtinValues = getBuiltinVariableValues();
  const renderedPreview = renderTemplate(content, builtinValues);

  // Render content with highlighted variables
  const highlightedContent = content.replace(
    /\{\{(\w+)\}\}/g,
    (match) => match
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "テンプレートを作成" : "テンプレートを編集"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "投稿に使用するテンプレートを作成します。"
              : "テンプレートの内容を編集します。"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.form && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              {errors.form}
            </div>
          )}

          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="template-name">テンプレート名</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 毎朝の挨拶テンプレート"
              maxLength={100}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="template-content">テンプレート内容</Label>
              <span className="text-xs text-muted-foreground">
                {content.length}/500
              </span>
            </div>
            <Textarea
              id="template-content"
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"例: おはようございます！\n今日は{{date}}（{{weekday}}）です。\n{{greeting}}"}
              className="min-h-[120px] font-mono text-sm"
              maxLength={500}
            />
            {errors.content && (
              <p className="text-sm text-destructive">{errors.content}</p>
            )}

            {/* Variable Inserter */}
            <VariableInserter onInsert={handleInsertVariable} />

            {/* Variables Found */}
            {variables.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">検出された変数:</span>
                {variables.map((v) => (
                  <Badge key={v} variant="secondary" className="text-xs font-mono">
                    <Braces className="h-3 w-3 mr-1" />
                    {v}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="template-category">カテゴリ（任意）</Label>
            <div className="relative">
              <Input
                id="template-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="例: 挨拶, お知らせ, プロモーション"
                maxLength={50}
                list="category-suggestions"
              />
              {categories.length > 0 && (
                <datalist id="category-suggestions">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              )}
            </div>
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category}</p>
            )}
          </div>

          {/* Media Type */}
          <div className="space-y-2">
            <Label>メディアタイプ</Label>
            <Select
              value={mediaType}
              onValueChange={(val) => setMediaType(val as MediaType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">テキスト</SelectItem>
                <SelectItem value="IMAGE">画像</SelectItem>
                <SelectItem value="VIDEO">動画</SelectItem>
                <SelectItem value="CAROUSEL">カルーセル</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Preview Toggle */}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview((v) => !v)}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              {showPreview ? "プレビューを閉じる" : "プレビューを表示"}
            </Button>
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">プレビュー</span>
                <span className="text-xs text-muted-foreground">
                  {renderedPreview.length} 文字
                </span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {renderedPreview || (
                  <span className="text-muted-foreground italic">
                    テンプレート内容を入力するとプレビューが表示されます
                  </span>
                )}
              </p>
              {variables.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  ※ 組み込み変数は現在の日時で置換されています。カスタム変数はそのまま表示されます。
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === "create" ? "作成" : "更新"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
