import { z } from "zod";

export const scheduleConfigSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "custom"]),
  time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式で入力してください"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  customCron: z.string().optional(),
});

export const createScheduleSchema = z
  .object({
    accountId: z.string().min(1, "アカウントを選択してください"),
    templateId: z.string().optional(),
    cronExpression: z.string().optional(),
    schedule: scheduleConfigSchema.optional(),
    timezone: z.string().default("Asia/Tokyo"),
  })
  .refine(
    (data) => data.cronExpression || data.schedule,
    { message: "スケジュールを設定してください" },
  );

export const updateScheduleSchema = z.object({
  cronExpression: z.string().optional(),
  schedule: scheduleConfigSchema.optional(),
  templateId: z.string().nullable().optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const toggleScheduleSchema = z.object({
  isActive: z.boolean(),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type ToggleScheduleInput = z.infer<typeof toggleScheduleSchema>;
export type ScheduleConfigInput = z.infer<typeof scheduleConfigSchema>;
