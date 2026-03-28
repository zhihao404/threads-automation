import { describe, it, expect } from "vitest";
import {
  scheduleConfigSchema,
  createScheduleSchema,
  updateScheduleSchema,
  toggleScheduleSchema,
} from "../schedule";

// =============================================================================
// scheduleConfigSchema
// =============================================================================

describe("scheduleConfigSchema", () => {
  it("accepts valid daily config", () => {
    const result = scheduleConfigSchema.safeParse({
      frequency: "daily",
      time: "09:00",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid weekly config with days", () => {
    const result = scheduleConfigSchema.safeParse({
      frequency: "weekly",
      time: "10:30",
      daysOfWeek: [1, 3, 5],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid monthly config", () => {
    const result = scheduleConfigSchema.safeParse({
      frequency: "monthly",
      time: "08:00",
      dayOfMonth: 15,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid custom config with customCron", () => {
    const result = scheduleConfigSchema.safeParse({
      frequency: "custom",
      time: "00:00",
      customCron: "*/5 * * * *",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid frequency", () => {
    const result = scheduleConfigSchema.safeParse({
      frequency: "yearly",
      time: "09:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid time format (no colon)", () => {
    const result = scheduleConfigSchema.safeParse({
      frequency: "daily",
      time: "0900",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid time format (single digits)", () => {
    const result = scheduleConfigSchema.safeParse({
      frequency: "daily",
      time: "9:0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid daysOfWeek values", () => {
    const result = scheduleConfigSchema.safeParse({
      frequency: "weekly",
      time: "09:00",
      daysOfWeek: [7], // max is 6
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative daysOfWeek values", () => {
    const result = scheduleConfigSchema.safeParse({
      frequency: "weekly",
      time: "09:00",
      daysOfWeek: [-1],
    });
    expect(result.success).toBe(false);
  });

  it("rejects dayOfMonth out of range (0)", () => {
    const result = scheduleConfigSchema.safeParse({
      frequency: "monthly",
      time: "09:00",
      dayOfMonth: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects dayOfMonth out of range (32)", () => {
    const result = scheduleConfigSchema.safeParse({
      frequency: "monthly",
      time: "09:00",
      dayOfMonth: 32,
    });
    expect(result.success).toBe(false);
  });

  it("accepts dayOfMonth at boundaries (1 and 31)", () => {
    expect(
      scheduleConfigSchema.safeParse({
        frequency: "monthly",
        time: "09:00",
        dayOfMonth: 1,
      }).success,
    ).toBe(true);
    expect(
      scheduleConfigSchema.safeParse({
        frequency: "monthly",
        time: "09:00",
        dayOfMonth: 31,
      }).success,
    ).toBe(true);
  });
});

// =============================================================================
// createScheduleSchema
// =============================================================================

describe("createScheduleSchema", () => {
  it("accepts valid schedule with cronExpression", () => {
    const result = createScheduleSchema.safeParse({
      accountId: "acc_123",
      cronExpression: "0 9 * * *",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid schedule with schedule config", () => {
    const result = createScheduleSchema.safeParse({
      accountId: "acc_123",
      schedule: {
        frequency: "daily",
        time: "09:00",
      },
    });
    expect(result.success).toBe(true);
  });

  it("defaults timezone to Asia/Tokyo", () => {
    const result = createScheduleSchema.safeParse({
      accountId: "acc_123",
      cronExpression: "0 9 * * *",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBe("Asia/Tokyo");
    }
  });

  it("accepts custom timezone", () => {
    const result = createScheduleSchema.safeParse({
      accountId: "acc_123",
      cronExpression: "0 9 * * *",
      timezone: "America/New_York",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBe("America/New_York");
    }
  });

  it("rejects missing accountId", () => {
    const result = createScheduleSchema.safeParse({
      cronExpression: "0 9 * * *",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty accountId", () => {
    const result = createScheduleSchema.safeParse({
      accountId: "",
      cronExpression: "0 9 * * *",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when neither cronExpression nor schedule is provided", () => {
    const result = createScheduleSchema.safeParse({
      accountId: "acc_123",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional templateId", () => {
    const result = createScheduleSchema.safeParse({
      accountId: "acc_123",
      cronExpression: "0 9 * * *",
      templateId: "tmpl_123",
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// updateScheduleSchema
// =============================================================================

describe("updateScheduleSchema", () => {
  it("accepts partial updates", () => {
    expect(
      updateScheduleSchema.safeParse({ cronExpression: "0 10 * * *" }).success,
    ).toBe(true);
    expect(
      updateScheduleSchema.safeParse({ timezone: "UTC" }).success,
    ).toBe(true);
    expect(
      updateScheduleSchema.safeParse({ isActive: false }).success,
    ).toBe(true);
  });

  it("accepts empty object", () => {
    expect(updateScheduleSchema.safeParse({}).success).toBe(true);
  });

  it("accepts nullable templateId", () => {
    expect(
      updateScheduleSchema.safeParse({ templateId: null }).success,
    ).toBe(true);
    expect(
      updateScheduleSchema.safeParse({ templateId: "tmpl_123" }).success,
    ).toBe(true);
  });
});

// =============================================================================
// toggleScheduleSchema
// =============================================================================

describe("toggleScheduleSchema", () => {
  it("accepts boolean isActive", () => {
    expect(toggleScheduleSchema.safeParse({ isActive: true }).success).toBe(true);
    expect(toggleScheduleSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("rejects missing isActive", () => {
    expect(toggleScheduleSchema.safeParse({}).success).toBe(false);
  });

  it("rejects non-boolean isActive", () => {
    expect(toggleScheduleSchema.safeParse({ isActive: "true" }).success).toBe(false);
    expect(toggleScheduleSchema.safeParse({ isActive: 1 }).success).toBe(false);
  });
});
