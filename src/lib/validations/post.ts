import { z } from "zod";

export const createPostSchema = z
  .object({
    accountId: z.string().min(1, "アカウントを選択してください"),
    content: z
      .string()
      .min(1, "投稿内容を入力してください")
      .max(500, "500文字以内で入力してください"),
    mediaType: z.enum(["TEXT", "IMAGE", "VIDEO", "CAROUSEL"]),
    mediaUrls: z.array(z.string().url("有効なURLを入力してください")).optional(),
    topicTag: z
      .string()
      .max(50, "トピックタグは50文字以内で入力してください")
      .optional(),
    replyControl: z
      .enum(["everyone", "accounts_you_follow", "mentioned_only"])
      .default("everyone"),
    status: z.enum(["draft", "scheduled", "publish"]),
    scheduledAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Validate: TEXT posts should not have media
    if (data.mediaType === "TEXT") {
      if (data.mediaUrls && data.mediaUrls.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: "テキスト投稿にはメディアを添付できません",
          path: ["mediaUrls"],
        });
      }
      return;
    }

    // Validate: IMAGE/VIDEO require at least 1 media
    if (data.mediaType === "IMAGE") {
      if (!data.mediaUrls || data.mediaUrls.length < 1) {
        ctx.addIssue({
          code: "custom",
          message: "画像を1つ以上アップロードしてください",
          path: ["mediaUrls"],
        });
      }
      return;
    }

    if (data.mediaType === "VIDEO") {
      if (!data.mediaUrls || data.mediaUrls.length < 1) {
        ctx.addIssue({
          code: "custom",
          message: "動画を1つアップロードしてください",
          path: ["mediaUrls"],
        });
      }
      return;
    }

    // Validate: CAROUSEL requires 2-20 media
    if (data.mediaType === "CAROUSEL") {
      if (!data.mediaUrls || data.mediaUrls.length < 2) {
        ctx.addIssue({
          code: "custom",
          message: "カルーセルには2枚以上のメディアが必要です",
          path: ["mediaUrls"],
        });
      } else if (data.mediaUrls.length > 20) {
        ctx.addIssue({
          code: "custom",
          message: "カルーセルのメディアは20枚以内にしてください",
          path: ["mediaUrls"],
        });
      }
    }
  });

export type CreatePostInput = z.infer<typeof createPostSchema>;
