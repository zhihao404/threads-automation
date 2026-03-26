"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ToneSelector } from "@/components/ai/tone-selector";
import type { ToneType, GeneratePostParams } from "@/lib/ai/generate";

interface GenerationFormProps {
  onGenerate: (params: GeneratePostParams) => void;
  isGenerating: boolean;
}

export function GenerationForm({ onGenerate, isGenerating }: GenerationFormProps) {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<ToneType>("casual");
  const [count, setCount] = useState(3);
  const [includeTopicTag, setIncludeTopicTag] = useState(true);
  const [language, setLanguage] = useState<"ja" | "en">("ja");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [context, setContext] = useState("");
  const [referenceContent, setReferenceContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isGenerating) return;

    onGenerate({
      topic: topic.trim(),
      tone,
      count,
      includeTopicTag,
      language,
      context: context.trim() || undefined,
      referenceContent: referenceContent.trim() || undefined,
    });
  };

  const topicLength = topic.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Topic Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="topic">トピック・キーワード</Label>
          <span
            className={cn(
              "text-xs tabular-nums",
              topicLength > 450
                ? "text-red-500"
                : topicLength > 400
                  ? "text-yellow-600"
                  : "text-muted-foreground"
            )}
          >
            {topicLength}/500
          </span>
        </div>
        <Textarea
          id="topic"
          placeholder="例: リモートワークの生産性を上げるコツ"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="min-h-[80px] resize-none"
          maxLength={500}
        />
      </div>

      {/* Tone Selector */}
      <div className="space-y-2">
        <Label>トーン</Label>
        <ToneSelector value={tone} onChange={setTone} />
      </div>

      {/* Count + Language Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="count">生成数</Label>
          <Select
            value={String(count)}
            onValueChange={(v) => setCount(Number(v))}
          >
            <SelectTrigger id="count">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}件
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="language">言語</Label>
          <Select
            value={language}
            onValueChange={(v) => setLanguage(v as "ja" | "en")}
          >
            <SelectTrigger id="language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ja">日本語</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Topic Tag Switch */}
      <div className="flex items-center justify-between">
        <Label htmlFor="includeTopicTag" className="cursor-pointer">
          トピックタグも提案する
        </Label>
        <Switch
          id="includeTopicTag"
          checked={includeTopicTag}
          onCheckedChange={setIncludeTopicTag}
        />
      </div>

      <Separator />

      {/* Advanced Options Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {showAdvanced ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
        詳細オプション
      </button>

      {showAdvanced && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Additional Context */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="context">
                追加の指示{" "}
                <span className="text-muted-foreground font-normal">
                  (オプション)
                </span>
              </Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {context.length}/1000
              </span>
            </div>
            <Textarea
              id="context"
              placeholder="例: 20代の社会人向けに書いてください"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="min-h-[60px] resize-none"
              maxLength={1000}
            />
          </div>

          {/* Reference Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="referenceContent">
                参考コンテンツ{" "}
                <span className="text-muted-foreground font-normal">
                  (オプション - このスタイルに合わせる)
                </span>
              </Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {referenceContent.length}/500
              </span>
            </div>
            <Textarea
              id="referenceContent"
              placeholder="スタイルを合わせたい投稿例を貼り付けてください"
              value={referenceContent}
              onChange={(e) => setReferenceContent(e.target.value)}
              className="min-h-[80px] resize-none"
              maxLength={500}
            />
          </div>
        </div>
      )}

      {/* Generate Button */}
      <Button
        type="submit"
        disabled={!topic.trim() || isGenerating}
        className="w-full gap-2"
        size="lg"
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {isGenerating ? "生成中..." : "AIで投稿を生成"}
      </Button>
    </form>
  );
}
