import { z } from "zod";

export const createTemplateSchema = z.object({
  name: z.string().min(1, "テンプレート名を入力してください").max(100, "テンプレート名は100文字以内で入力してください"),
  content: z.string().min(1, "テンプレート内容を入力してください").max(500, "テンプレート内容は500文字以内で入力してください"),
  category: z.string().max(50, "カテゴリは50文字以内で入力してください").optional(),
  mediaType: z.enum(["TEXT", "IMAGE", "VIDEO", "CAROUSEL"]).default("TEXT"),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const renderTemplateSchema = z.object({
  variables: z.record(z.string(), z.string()),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type RenderTemplateInput = z.infer<typeof renderTemplateSchema>;
