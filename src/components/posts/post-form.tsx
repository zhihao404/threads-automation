"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Send,
  Calendar,
  Save,
  Loader2,
  Type,
  Image,
  Video,
  LayoutGrid,
  AlertCircle,
  Info,
} from "lucide-react";
import { MediaUpload } from "@/components/media/media-upload";
import { CarouselManager } from "@/components/posts/carousel-manager";
import { MediaPreview } from "@/components/posts/media-preview";
import type { UploadResult } from "@/lib/media";

export interface AccountOption {
  id: string;
  username: string;
  displayName: string | null;
  profilePictureUrl: string | null;
  tokenStatus: "valid" | "expiring_soon" | "expired";
}

interface PostFormProps {
  accounts: AccountOption[];
  initialContent?: string;
  initialTopicTag?: string;
}

interface FormErrors {
  accountId?: string;
  content?: string;
  mediaUrls?: string;
  topicTag?: string;
  scheduledAt?: string;
  general?: string;
}

type MediaType = "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";
type SubmitStatus = "idle" | "publishing" | "scheduling" | "saving";

export function PostForm({ accounts, initialContent, initialTopicTag }: PostFormProps) {
  const router = useRouter();

  // Form state
  const [accountId, setAccountId] = useState("");
  const [content, setContent] = useState(initialContent || "");
  const [mediaType, setMediaType] = useState<MediaType>("TEXT");
  const [topicTag, setTopicTag] = useState(initialTopicTag || "");
  const [replyControl, setReplyControl] = useState<
    "everyone" | "accounts_you_follow" | "mentioned_only"
  >("everyone");
  const [scheduledAt, setScheduledAt] = useState("");
  const [showScheduler, setShowScheduler] = useState(false);

  // Media state
  const [uploadedFiles, setUploadedFiles] = useState<UploadResult[]>([]);

  // UI state
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState("");

  const charCount = content.length;
  const charRemaining = 500 - charCount;
  const isOverLimit = charRemaining < 0;
  const isNearLimit = charRemaining <= 50 && charRemaining >= 0;

  // Handle media type switching
  const handleMediaTypeChange = useCallback(
    (newType: MediaType) => {
      if (newType === mediaType) return;

      if (uploadedFiles.length > 0) {
        const confirmed = window.confirm(
          "メディアタイプを変更すると、アップロード済みのファイルがクリアされます。よろしいですか？"
        );
        if (!confirmed) return;
      }

      setMediaType(newType);
      setUploadedFiles([]);
      setErrors((prev) => ({ ...prev, mediaUrls: undefined }));
    },
    [mediaType, uploadedFiles.length]
  );

  // Handle file upload
  const handleUpload = useCallback((results: UploadResult[]) => {
    setUploadedFiles((prev) => [...prev, ...results]);
    setErrors((prev) => ({ ...prev, mediaUrls: undefined }));
  }, []);

  // Handle file removal
  const handleRemove = useCallback((key: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.key !== key));
  }, []);

  // Handle carousel reorder
  const handleReorder = useCallback((items: UploadResult[]) => {
    setUploadedFiles(items);
  }, []);

  const validateForm = useCallback(
    (status: "draft" | "scheduled" | "publish"): FormErrors => {
      const newErrors: FormErrors = {};

      if (!accountId) {
        newErrors.accountId = "アカウントを選択してください";
      }

      if (!content.trim()) {
        newErrors.content = "投稿内容を入力してください";
      } else if (content.length > 500) {
        newErrors.content = "500文字以内で入力してください";
      }

      // Media validation
      if (mediaType === "IMAGE" && uploadedFiles.length < 1) {
        newErrors.mediaUrls = "画像を1つアップロードしてください";
      }
      if (mediaType === "VIDEO" && uploadedFiles.length < 1) {
        newErrors.mediaUrls = "動画を1つアップロードしてください";
      }
      if (mediaType === "CAROUSEL") {
        if (uploadedFiles.length < 2) {
          newErrors.mediaUrls =
            "カルーセルには2枚以上のメディアが必要です";
        } else if (uploadedFiles.length > 20) {
          newErrors.mediaUrls =
            "カルーセルのメディアは20枚以内にしてください";
        }
      }

      if (topicTag.length > 50) {
        newErrors.topicTag = "トピックタグは50文字以内で入力してください";
      }

      if (status === "scheduled" && !scheduledAt) {
        newErrors.scheduledAt = "予約日時を指定してください";
      }

      if (status === "scheduled" && scheduledAt) {
        const scheduledDate = new Date(scheduledAt);
        if (scheduledDate <= new Date()) {
          newErrors.scheduledAt = "未来の日時を指定してください";
        }
      }

      // Check if selected account token is valid
      const selectedAccount = accounts.find((a) => a.id === accountId);
      if (
        selectedAccount?.tokenStatus === "expired" &&
        status === "publish"
      ) {
        newErrors.accountId =
          "このアカウントのトークンが期限切れです。再接続してください。";
      }

      return newErrors;
    },
    [accountId, content, mediaType, uploadedFiles, topicTag, scheduledAt, accounts]
  );

  const handleSubmit = useCallback(
    async (status: "draft" | "scheduled" | "publish") => {
      setErrors({});
      setSuccessMessage("");

      const validationErrors = validateForm(status);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      const statusMap: Record<string, SubmitStatus> = {
        publish: "publishing",
        scheduled: "scheduling",
        draft: "saving",
      };
      setSubmitStatus(statusMap[status] as SubmitStatus);

      try {
        // Extract URLs from uploaded files
        const mediaUrls =
          uploadedFiles.length > 0
            ? uploadedFiles.map((f) => f.url)
            : undefined;

        const response = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            content: content.trim(),
            mediaType,
            mediaUrls,
            topicTag: topicTag.trim() || undefined,
            replyControl,
            status,
            scheduledAt: status === "scheduled" ? scheduledAt : undefined,
          }),
        });

        const data = (await response.json()) as {
          error?: string;
          status?: string;
        };

        if (!response.ok) {
          setErrors({
            general:
              data.error || "エラーが発生しました。もう一度お試しください。",
          });
          return;
        }

        const messages: Record<string, string> = {
          published: "投稿が公開されました！",
          scheduled: "投稿が予約されました！",
          draft: "下書きが保存されました！",
          failed: "投稿の公開に失敗しました。下書きとして保存されました。",
        };
        setSuccessMessage(
          messages[data.status || ""] || "保存しました！"
        );

        // Redirect to posts list after a short delay
        setTimeout(() => {
          router.push("/posts");
        }, 1500);
      } catch {
        setErrors({
          general:
            "ネットワークエラーが発生しました。もう一度お試しください。",
        });
      } finally {
        setSubmitStatus("idle");
      }
    },
    [
      accountId,
      content,
      mediaType,
      uploadedFiles,
      topicTag,
      replyControl,
      scheduledAt,
      validateForm,
      router,
    ]
  );

  const isSubmitting = submitStatus !== "idle";

  // Determine media upload type for the MediaUpload component
  const uploadMediaType: "image" | "video" | undefined =
    mediaType === "IMAGE"
      ? "image"
      : mediaType === "VIDEO"
        ? "video"
        : mediaType === "CAROUSEL"
          ? "image"
          : undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form Section */}
      <div className="lg:col-span-2 space-y-6">
        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            {successMessage}
          </div>
        )}

        {/* General Error */}
        {errors.general && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.general}
          </div>
        )}

        {/* Account Selector */}
        <div className="space-y-2">
          <Label htmlFor="account">投稿アカウント</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger
              id="account"
              className={cn(errors.accountId && "border-red-500")}
            >
              <SelectValue placeholder="アカウントを選択" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem
                  key={account.id}
                  value={account.id}
                  disabled={account.tokenStatus === "expired"}
                >
                  <div className="flex items-center gap-2">
                    <span>@{account.username}</span>
                    {account.tokenStatus === "expired" && (
                      <Badge variant="destructive" className="text-[10px] h-4">
                        期限切れ
                      </Badge>
                    )}
                    {account.tokenStatus === "expiring_soon" && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 text-yellow-600 border-yellow-300"
                      >
                        まもなく期限切れ
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
              {accounts.length === 0 && (
                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                  接続済みのアカウントがありません
                </div>
              )}
            </SelectContent>
          </Select>
          {errors.accountId && (
            <p className="text-xs text-red-500">{errors.accountId}</p>
          )}
        </div>

        {/* Content */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="content">投稿内容</Label>
            <span
              className={cn(
                "text-xs tabular-nums",
                isOverLimit
                  ? "text-red-500 font-semibold"
                  : isNearLimit
                    ? "text-yellow-600"
                    : "text-muted-foreground"
              )}
            >
              {charRemaining}
            </span>
          </div>
          <Textarea
            id="content"
            placeholder="今何してる？"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={cn(
              "min-h-[160px] resize-none",
              errors.content && "border-red-500",
              isOverLimit && "border-red-500 focus-visible:ring-red-500"
            )}
            maxLength={600}
          />
          {errors.content && (
            <p className="text-xs text-red-500">{errors.content}</p>
          )}
        </div>

        {/* Media Type */}
        <div className="space-y-2">
          <Label>メディアタイプ</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "TEXT" as const, label: "テキストのみ", icon: Type },
              { value: "IMAGE" as const, label: "画像付き", icon: Image },
              { value: "VIDEO" as const, label: "動画付き", icon: Video },
              {
                value: "CAROUSEL" as const,
                label: "カルーセル",
                icon: LayoutGrid,
              },
            ].map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                type="button"
                variant={mediaType === value ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => handleMediaTypeChange(value)}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Media Upload Section */}
        {mediaType !== "TEXT" && uploadMediaType && (
          <div className="space-y-3">
            {/* Carousel info indicator */}
            {mediaType === "CAROUSEL" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <Info className="h-4 w-4 shrink-0" />
                <span>2-20枚の画像・動画を選択</span>
              </div>
            )}

            {/* MediaUpload component */}
            <MediaUpload
              mediaType={uploadMediaType}
              multiple={mediaType === "CAROUSEL"}
              maxFiles={mediaType === "CAROUSEL" ? 20 : 1}
              onUpload={handleUpload}
              onRemove={handleRemove}
              uploadedFiles={uploadedFiles}
            />

            {/* Carousel manager for reordering */}
            {mediaType === "CAROUSEL" && uploadedFiles.length > 0 && (
              <CarouselManager
                items={uploadedFiles}
                onReorder={handleReorder}
                onRemove={handleRemove}
              />
            )}

            {/* Media validation error */}
            {errors.mediaUrls && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {errors.mediaUrls}
              </p>
            )}
          </div>
        )}

        {/* Topic Tag */}
        <div className="space-y-2">
          <Label htmlFor="topicTag">
            トピックタグ{" "}
            <span className="text-muted-foreground font-normal">
              (オプション)
            </span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              #
            </span>
            <Input
              id="topicTag"
              placeholder="例: テクノロジー"
              value={topicTag}
              onChange={(e) => setTopicTag(e.target.value)}
              className={cn("pl-7", errors.topicTag && "border-red-500")}
              maxLength={50}
            />
          </div>
          {errors.topicTag && (
            <p className="text-xs text-red-500">{errors.topicTag}</p>
          )}
        </div>

        {/* Reply Control */}
        <div className="space-y-2">
          <Label htmlFor="replyControl">返信の許可</Label>
          <Select
            value={replyControl}
            onValueChange={(v) =>
              setReplyControl(
                v as "everyone" | "accounts_you_follow" | "mentioned_only"
              )
            }
          >
            <SelectTrigger id="replyControl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">全員</SelectItem>
              <SelectItem value="accounts_you_follow">
                フォローしているアカウント
              </SelectItem>
              <SelectItem value="mentioned_only">
                メンションされたアカウントのみ
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Schedule Date/Time */}
        {showScheduler && (
          <div className="space-y-2">
            <Label htmlFor="scheduledAt">予約日時</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={cn(errors.scheduledAt && "border-red-500")}
              min={new Date().toISOString().slice(0, 16)}
            />
            {errors.scheduledAt && (
              <p className="text-xs text-red-500">{errors.scheduledAt}</p>
            )}
          </div>
        )}

        <Separator />

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => handleSubmit("publish")}
            disabled={isSubmitting || isOverLimit}
            className="gap-2"
          >
            {submitStatus === "publishing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            今すぐ投稿
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!showScheduler) {
                setShowScheduler(true);
              } else {
                handleSubmit("scheduled");
              }
            }}
            disabled={isSubmitting || isOverLimit}
            className="gap-2"
          >
            {submitStatus === "scheduling" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
            {showScheduler ? "予約する" : "予約投稿"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit("draft")}
            disabled={isSubmitting}
            className="gap-2"
          >
            {submitStatus === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            下書き保存
          </Button>
        </div>
      </div>

      {/* Preview Section */}
      <div className="lg:col-span-1">
        <Card className="sticky top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              プレビュー
            </CardTitle>
          </CardHeader>
          <CardContent>
            {content.trim() || uploadedFiles.length > 0 ? (
              <div className="space-y-3">
                {/* Account info */}
                {accountId && (
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {accounts
                        .find((a) => a.id === accountId)
                        ?.username?.charAt(0)
                        .toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-none">
                        {accounts.find((a) => a.id === accountId)
                          ?.displayName ||
                          accounts.find((a) => a.id === accountId)?.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @
                        {accounts.find((a) => a.id === accountId)?.username}
                      </p>
                    </div>
                  </div>
                )}

                {/* Content preview */}
                {content.trim() && (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {content}
                  </p>
                )}

                {/* Media preview - show actual uploaded thumbnails */}
                {uploadedFiles.length > 0 && (
                  <MediaPreview
                    mediaType={mediaType}
                    mediaUrls={uploadedFiles.map((f) => f.url)}
                    compact
                  />
                )}

                {/* Media type indicator when no files uploaded yet */}
                {mediaType !== "TEXT" && uploadedFiles.length === 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {mediaType === "IMAGE" && (
                      <>
                        <Image className="h-3.5 w-3.5" />
                        <span>画像が添付されます</span>
                      </>
                    )}
                    {mediaType === "VIDEO" && (
                      <>
                        <Video className="h-3.5 w-3.5" />
                        <span>動画が添付されます</span>
                      </>
                    )}
                    {mediaType === "CAROUSEL" && (
                      <>
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span>カルーセルが添付されます</span>
                      </>
                    )}
                  </div>
                )}

                {/* Topic tag */}
                {topicTag && (
                  <p className="text-sm text-blue-600">#{topicTag}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                投稿内容を入力するとプレビューが表示されます
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
