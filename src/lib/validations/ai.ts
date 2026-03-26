import { z } from "zod";

export const generatePostSchema = z.object({
  topic: z.string().min(1, "トピックを入力してください").max(500),
  tone: z.enum([
    "casual",
    "professional",
    "humorous",
    "informative",
    "inspiring",
    "provocative",
  ]),
  context: z.string().max(1000).optional(),
  language: z.enum(["ja", "en"]).default("ja"),
  count: z.number().int().min(1).max(5).default(3),
  includeTopicTag: z.boolean().default(true),
  referenceContent: z.string().max(500).optional(),
});

export type GeneratePostInput = z.infer<typeof generatePostSchema>;

export const suggestTagsSchema = z.object({
  content: z.string().min(1, "投稿内容を入力してください").max(500),
  count: z.number().int().min(1).max(10).optional(),
});

export type SuggestTagsInput = z.infer<typeof suggestTagsSchema>;

export const improvePostSchema = z.object({
  content: z.string().min(1, "投稿内容を入力してください").max(500),
  goal: z
    .enum(["engagement", "clarity", "shorter", "casual", "professional"])
    .optional(),
});

export type ImprovePostInput = z.infer<typeof improvePostSchema>;
