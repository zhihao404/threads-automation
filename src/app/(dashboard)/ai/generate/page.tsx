"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  History,
  Check,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { GenerationForm } from "@/components/ai/generation-form";
import { GeneratedPostCard } from "@/components/ai/generated-post-card";
import type {
  GeneratePostParams,
  GeneratedPost,
  GenerateResult,
} from "@/lib/ai/generate";
import type { ImprovementSuggestion } from "@/lib/ai/improve";

interface HistoryEntry {
  id: string;
  params: GeneratePostParams;
  posts: GeneratedPost[];
  createdAt: string;
}

const HISTORY_KEY = "ai-generation-history";
const MAX_HISTORY = 10;

const improvementGoals = [
  { value: "engagement", label: "エンゲージメントを増やす" },
  { value: "clarity", label: "メッセージを明確にする" },
  { value: "shorter", label: "より短くまとめる" },
  { value: "casual", label: "よりカジュアルに" },
  { value: "professional", label: "よりプロフェッショナルに" },
] as const;

export default function AIGeneratePage() {
  const router = useRouter();
  const [results, setResults] = useState<GeneratedPost[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(
    null
  );
  const [error, setError] = useState("");
  const [lastParams, setLastParams] = useState<GeneratePostParams | null>(null);

  // Improvement dialog state
  const [improveTarget, setImproveTarget] = useState<GeneratedPost | null>(
    null
  );
  const [improveGoal, setImproveGoal] = useState<string>("engagement");
  const [improvements, setImprovements] = useState<ImprovementSuggestion[]>([]);
  const [isImproving, setIsImproving] = useState(false);
  const [improveError, setImproveError] = useState("");

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load history from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(HISTORY_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const saveHistory = useCallback(
    (params: GeneratePostParams, posts: GeneratedPost[]) => {
      const entry: HistoryEntry = {
        id: Date.now().toString(),
        params,
        posts,
        createdAt: new Date().toISOString(),
      };
      const updated = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(updated);
      try {
        sessionStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
    },
    [history]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      sessionStorage.removeItem(HISTORY_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const handleGenerate = useCallback(
    async (params: GeneratePostParams) => {
      setIsGenerating(true);
      setError("");
      setResults([]);
      setLastParams(params);

      try {
        const response = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = (await response.json()) as GenerateResult & {
          error?: string;
        };

        if (!response.ok) {
          setError(data.error || "生成に失敗しました。もう一度お試しください。");
          return;
        }

        setResults(data.posts);
        saveHistory(params, data.posts);
      } catch {
        setError("ネットワークエラーが発生しました。もう一度お試しください。");
      } finally {
        setIsGenerating(false);
      }
    },
    [saveHistory]
  );

  const handleRegenerate = useCallback(
    async (index: number) => {
      if (!lastParams) return;
      setRegeneratingIndex(index);

      try {
        const response = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...lastParams, count: 1 }),
        });

        const data = (await response.json()) as GenerateResult & {
          error?: string;
        };

        if (!response.ok) {
          setError(data.error || "再生成に失敗しました。");
          return;
        }

        if (data.posts.length > 0) {
          setResults((prev) => {
            const updated = [...prev];
            updated[index] = data.posts[0]!;
            return updated;
          });
        }
      } catch {
        setError("ネットワークエラーが発生しました。");
      } finally {
        setRegeneratingIndex(null);
      }
    },
    [lastParams]
  );

  const handleUse = useCallback(
    (post: GeneratedPost) => {
      // Store content in sessionStorage for the new post page to pick up
      try {
        sessionStorage.setItem(
          "ai-generated-content",
          JSON.stringify({
            content: post.content,
            topicTag: post.topicTag || "",
          })
        );
      } catch {
        // Ignore
      }
      router.push("/posts/new?from=ai");
    },
    [router]
  );

  const handleCopy = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Fallback: do nothing, the button UI handles feedback
    }
  }, []);

  const handleImproveOpen = useCallback((post: GeneratedPost) => {
    setImproveTarget(post);
    setImprovements([]);
    setImproveError("");
    setImproveGoal("engagement");
  }, []);

  const handleImproveClose = useCallback(() => {
    setImproveTarget(null);
    setImprovements([]);
    setImproveError("");
  }, []);

  const handleImprove = useCallback(async () => {
    if (!improveTarget) return;
    setIsImproving(true);
    setImproveError("");
    setImprovements([]);

    try {
      const response = await fetch("/api/ai/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: improveTarget.content,
          goal: improveGoal,
        }),
      });

      const data = (await response.json()) as {
        suggestions?: ImprovementSuggestion[];
        error?: string;
      };

      if (!response.ok) {
        setImproveError(
          data.error || "改善提案の取得に失敗しました。"
        );
        return;
      }

      setImprovements(data.suggestions || []);
    } catch {
      setImproveError("ネットワークエラーが発生しました。");
    } finally {
      setIsImproving(false);
    }
  }, [improveTarget, improveGoal]);

  const handleApplyImprovement = useCallback(
    (suggestion: ImprovementSuggestion) => {
      if (!improveTarget) return;

      setResults((prev) =>
        prev.map((p) =>
          p === improveTarget
            ? {
                ...p,
                content: suggestion.improved,
                charCount: suggestion.improved.length,
              }
            : p
        )
      );
      handleImproveClose();
    },
    [improveTarget, handleImproveClose]
  );

  const handleRestoreHistory = useCallback((entry: HistoryEntry) => {
    setResults(entry.posts);
    setLastParams(entry.params);
    setShowHistory(false);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          AI投稿生成
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          AIがトピックに合わせたThreads投稿を自動生成します。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Generation Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">生成設定</CardTitle>
            </CardHeader>
            <CardContent>
              <GenerationForm
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-3 space-y-4">
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Loading state */}
          {isGenerating && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">
                  AIが投稿を生成しています...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  数秒かかる場合があります
                </p>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {!isGenerating && results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">
                  生成結果 ({results.length}件)
                </h2>
              </div>
              {results.map((post, index) => (
                <GeneratedPostCard
                  key={`${index}-${post.content.slice(0, 20)}`}
                  post={post}
                  index={index}
                  onUse={handleUse}
                  onCopy={handleCopy}
                  onImprove={handleImproveOpen}
                  onRegenerate={handleRegenerate}
                  isRegenerating={regeneratingIndex === index}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isGenerating && results.length === 0 && !error && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-1">
                  投稿を生成しましょう
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  左のフォームにトピックとトーンを設定して、AIに投稿を生成してもらいましょう。
                </p>
              </CardContent>
            </Card>
          )}

          {/* History Section */}
          {history.length > 0 && (
            <>
              <Separator />
              <div>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <History className="h-4 w-4" />
                  生成履歴 ({history.length}件)
                </button>

                {showHistory && (
                  <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearHistory}
                        className="gap-1.5 text-xs text-muted-foreground"
                      >
                        <Trash2 className="h-3 w-3" />
                        履歴をクリア
                      </Button>
                    </div>
                    {history.map((entry) => (
                      <Card
                        key={entry.id}
                        className="cursor-pointer hover:bg-accent/30 transition-colors"
                        onClick={() => handleRestoreHistory(entry)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {entry.params.topic}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {entry.params.tone}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {entry.posts.length}件生成
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(
                                    entry.createdAt
                                  ).toLocaleTimeString("ja-JP", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Improvement Dialog */}
      <Dialog
        open={improveTarget !== null}
        onOpenChange={(open) => {
          if (!open) handleImproveClose();
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>投稿を改善</DialogTitle>
            <DialogDescription>
              改善の方向性を選んで、AIに改善案を提案してもらいましょう。
            </DialogDescription>
          </DialogHeader>

          {improveTarget && (
            <div className="space-y-4">
              {/* Original Content */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  元の投稿
                </p>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm whitespace-pre-wrap">
                    {improveTarget.content}
                  </p>
                </div>
              </div>

              {/* Goal Selection */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  改善の方向性
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {improvementGoals.map((g) => (
                    <Button
                      key={g.value}
                      type="button"
                      size="sm"
                      variant={
                        improveGoal === g.value ? "default" : "outline"
                      }
                      onClick={() => setImproveGoal(g.value)}
                      className="text-xs"
                    >
                      {g.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Improve Button */}
              <Button
                onClick={handleImprove}
                disabled={isImproving}
                className="w-full gap-2"
              >
                {isImproving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isImproving ? "改善案を生成中..." : "改善案を取得"}
              </Button>

              {/* Improve Error */}
              {improveError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-xs flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {improveError}
                </div>
              )}

              {/* Improvement Suggestions */}
              {improvements.length > 0 && (
                <div className="space-y-3">
                  <Separator />
                  <p className="text-xs font-medium text-muted-foreground">
                    改善案 ({improvements.length}件)
                  </p>
                  {improvements.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <p className="text-sm whitespace-pre-wrap">
                        {suggestion.improved}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {suggestion.explanation}
                      </p>
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            suggestion.improved.length > 500
                              ? "text-red-500"
                              : "text-muted-foreground"
                          )}
                        >
                          {suggestion.improved.length}/500文字
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleApplyImprovement(suggestion)}
                          className="gap-1.5"
                        >
                          <Check className="h-3.5 w-3.5" />
                          適用
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
