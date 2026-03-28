import { describe, it, expect } from "vitest";
import {
  isValidCron,
  getNextRunTime,
  getNextRunTimes,
  describeCron,
  buildCronExpression,
  type ScheduleConfig,
} from "../parser";

// =============================================================================
// isValidCron
// =============================================================================

describe("isValidCron", () => {
  it("accepts standard wildcard expression", () => {
    expect(isValidCron("* * * * *")).toBe(true);
  });

  it("accepts specific values", () => {
    expect(isValidCron("0 9 * * *")).toBe(true);
    expect(isValidCron("30 14 1 6 3")).toBe(true);
  });

  it("accepts ranges", () => {
    expect(isValidCron("0-30 9-17 * * *")).toBe(true);
  });

  it("accepts lists", () => {
    expect(isValidCron("0,15,30,45 * * * *")).toBe(true);
  });

  it("accepts steps", () => {
    expect(isValidCron("*/5 * * * *")).toBe(true);
    expect(isValidCron("0 */2 * * *")).toBe(true);
  });

  it("accepts range with step", () => {
    expect(isValidCron("1-30/5 * * * *")).toBe(true);
  });

  it("rejects expressions with wrong number of fields", () => {
    expect(isValidCron("* * *")).toBe(false);
    expect(isValidCron("* * * * * *")).toBe(false);
    expect(isValidCron("")).toBe(false);
  });

  it("rejects invalid characters", () => {
    expect(isValidCron("abc * * * *")).toBe(false);
    expect(isValidCron("* * * * xyz")).toBe(false);
  });

  it("rejects invalid step values", () => {
    expect(isValidCron("*/0 * * * *")).toBe(false);
    expect(isValidCron("*/-1 * * * *")).toBe(false);
  });

  it("rejects invalid range values", () => {
    expect(isValidCron("a-b * * * *")).toBe(false);
  });
});

// =============================================================================
// getNextRunTime
// =============================================================================

describe("getNextRunTime", () => {
  const tz = "Asia/Tokyo";

  it("returns a Date for a simple daily cron", () => {
    // Every day at 09:00
    const after = new Date("2025-01-15T00:00:00Z"); // 09:00 JST
    const next = getNextRunTime("0 9 * * *", tz, after);
    expect(next).toBeInstanceOf(Date);
    expect(next).not.toBeNull();
  });

  it("returns the next occurrence after the given time", () => {
    // Every day at 09:00 JST. After is 2025-01-15 09:00 JST (= 00:00 UTC)
    // Next should be 2025-01-16 09:00 JST
    const after = new Date("2025-01-15T00:00:00Z");
    const next = getNextRunTime("0 9 * * *", tz, after);
    expect(next).not.toBeNull();
    if (next) {
      // Verify it's after the 'after' date
      expect(next.getTime()).toBeGreaterThan(after.getTime());
    }
  });

  it("handles every-5-minutes cron", () => {
    const after = new Date("2025-06-01T00:00:00Z");
    const next = getNextRunTime("*/5 * * * *", tz, after);
    expect(next).not.toBeNull();
  });

  it("handles monthly cron (1st of month at 10:00)", () => {
    const after = new Date("2025-03-01T01:00:00Z"); // 10:00 JST
    const next = getNextRunTime("0 10 1 * *", tz, after);
    expect(next).not.toBeNull();
    if (next) {
      // Should be April 1st or later since March 1st 10:00 has passed
      expect(next.getTime()).toBeGreaterThan(after.getTime());
    }
  });

  it("handles weekly cron (Monday at 08:00)", () => {
    // 2025-01-13 is a Monday
    const after = new Date("2025-01-12T23:00:00Z"); // Sunday Jan 12 at 08:00 JST
    const next = getNextRunTime("0 8 * * 1", tz, after);
    expect(next).not.toBeNull();
  });

  it("handles day-of-week restriction", () => {
    // Cron with dow constraint returns a date after the start
    const after = new Date("2025-01-01T00:00:00Z");
    const next = getNextRunTime("0 12 * * 1", tz, after);
    expect(next).not.toBeNull();
    if (next) {
      expect(next.getTime()).toBeGreaterThan(after.getTime());
    }
  });

  it("handles specific month restriction", () => {
    // Only in January and July, on the 1st, at 00:00
    const after = new Date("2025-02-01T00:00:00Z");
    const next = getNextRunTime("0 0 1 1,7 *", tz, after);
    expect(next).not.toBeNull();
    if (next) {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        month: "numeric",
      });
      const month = parseInt(formatter.format(next), 10);
      expect([1, 7]).toContain(month);
    }
  });

  it("returns null for impossible cron (Feb 31)", () => {
    // 31st of February - never happens, but also matches other months
    // Actually cron "0 0 31 2 *" means 31st of Feb only which never happens
    const after = new Date("2025-01-01T00:00:00Z");
    const next = getNextRunTime("0 0 31 2 *", tz, after);
    // Feb never has 31 days, so this should be null
    expect(next).toBeNull();
  });

  it("uses different timezones correctly", () => {
    const after = new Date("2025-06-15T00:00:00Z");
    const tokyoNext = getNextRunTime("0 9 * * *", "Asia/Tokyo", after);
    const nyNext = getNextRunTime("0 9 * * *", "America/New_York", after);
    expect(tokyoNext).not.toBeNull();
    expect(nyNext).not.toBeNull();
    if (tokyoNext && nyNext) {
      // Tokyo 09:00 is much earlier in UTC than New York 09:00
      expect(tokyoNext.getTime()).not.toBe(nyNext.getTime());
    }
  });
});

// =============================================================================
// getNextRunTimes
// =============================================================================

describe("getNextRunTimes", () => {
  const tz = "Asia/Tokyo";

  it("returns the requested number of run times", () => {
    const results = getNextRunTimes("0 9 * * *", tz, 5);
    expect(results).toHaveLength(5);
  });

  it("returns times in ascending order", () => {
    const results = getNextRunTimes("0 9 * * *", tz, 3);
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.getTime()).toBeGreaterThan(results[i - 1]!.getTime());
    }
  });

  it("returns empty array for impossible cron", () => {
    const results = getNextRunTimes("0 0 31 2 *", tz, 5);
    expect(results).toHaveLength(0);
  });

  it("returns correct count for frequent cron", () => {
    // Every 5 minutes - should easily find 3
    const results = getNextRunTimes("*/5 * * * *", tz, 3);
    expect(results).toHaveLength(3);
  });
});

// =============================================================================
// describeCron
// =============================================================================

describe("describeCron", () => {
  it("describes every N minutes", () => {
    expect(describeCron("*/5 * * * *")).toBe("5分ごと");
    expect(describeCron("*/15 * * * *")).toBe("15分ごと");
  });

  it("describes every N hours", () => {
    expect(describeCron("0 */2 * * *")).toBe("2時間ごと (00分)");
    expect(describeCron("30 */3 * * *")).toBe("3時間ごと (30分)");
  });

  it("describes daily cron", () => {
    expect(describeCron("0 9 * * *")).toBe("毎日 09:00");
    expect(describeCron("30 14 * * *")).toBe("毎日 14:30");
  });

  it("describes weekly cron with single day", () => {
    expect(describeCron("0 9 * * 1")).toBe("毎週月曜日 09:00");
    expect(describeCron("0 10 * * 0")).toBe("毎週日曜日 10:00");
  });

  it("describes weekday cron", () => {
    expect(describeCron("0 9 * * 1-5")).toBe("平日 09:00");
  });

  it("describes weekend cron", () => {
    expect(describeCron("0 10 * * 0,6")).toBe("週末 10:00");
  });

  it("describes multiple specific days", () => {
    const result = describeCron("0 9 * * 1,3,5");
    expect(result).toContain("月");
    expect(result).toContain("水");
    expect(result).toContain("金");
  });

  it("describes monthly cron", () => {
    expect(describeCron("0 9 1 * *")).toBe("毎月1日 09:00");
    expect(describeCron("0 9 15 * *")).toBe("毎月15日 09:00");
  });

  it("describes specific month cron", () => {
    const result = describeCron("0 9 1 1 *");
    expect(result).toContain("1月");
  });

  it("falls back to raw expression for invalid cron", () => {
    expect(describeCron("invalid")).toBe("invalid");
  });
});

// =============================================================================
// buildCronExpression
// =============================================================================

describe("buildCronExpression", () => {
  it("builds daily cron", () => {
    const config: ScheduleConfig = {
      frequency: "daily",
      time: "09:00",
    };
    expect(buildCronExpression(config)).toBe("0 9 * * *");
  });

  it("builds daily cron with minutes", () => {
    const config: ScheduleConfig = {
      frequency: "daily",
      time: "14:30",
    };
    expect(buildCronExpression(config)).toBe("30 14 * * *");
  });

  it("builds weekly cron with specified days", () => {
    const config: ScheduleConfig = {
      frequency: "weekly",
      time: "10:00",
      daysOfWeek: [1, 3, 5],
    };
    expect(buildCronExpression(config)).toBe("0 10 * * 1,3,5");
  });

  it("builds weekly cron defaulting to Monday when no days specified", () => {
    const config: ScheduleConfig = {
      frequency: "weekly",
      time: "10:00",
    };
    expect(buildCronExpression(config)).toBe("0 10 * * 1");
  });

  it("builds monthly cron", () => {
    const config: ScheduleConfig = {
      frequency: "monthly",
      time: "08:00",
      dayOfMonth: 15,
    };
    expect(buildCronExpression(config)).toBe("0 8 15 * *");
  });

  it("builds monthly cron defaulting to 1st when no day specified", () => {
    const config: ScheduleConfig = {
      frequency: "monthly",
      time: "08:00",
    };
    expect(buildCronExpression(config)).toBe("0 8 1 * *");
  });

  it("passes through custom cron expression", () => {
    const config: ScheduleConfig = {
      frequency: "custom",
      time: "00:00",
      customCron: "*/15 * * * *",
    };
    expect(buildCronExpression(config)).toBe("*/15 * * * *");
  });

  it("falls back to daily for custom without customCron", () => {
    const config: ScheduleConfig = {
      frequency: "custom",
      time: "12:00",
    };
    // Falls through to default case
    expect(buildCronExpression(config)).toBe("0 12 * * *");
  });
});
