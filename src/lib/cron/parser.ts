// =============================================================================
// Cron Expression Parser & Utilities
//
// Supports standard 5-field cron: minute hour day-of-month month day-of-week
// Field ranges: minute(0-59) hour(0-23) dom(1-31) month(1-12) dow(0-6, 0=Sun)
// Syntax: * (any), specific values, ranges (1-5), lists (1,3,5), steps (*/5)
// =============================================================================

interface CronField {
  values: Set<number>;
}

/**
 * Parse a single cron field into a set of valid values.
 */
function parseField(field: string, min: number, max: number): CronField {
  const values = new Set<number>();

  const parts = field.split(",");
  for (const part of parts) {
    if (part === "*") {
      for (let i = min; i <= max; i++) values.add(i);
    } else if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step <= 0) throw new Error(`Invalid step: ${stepStr}`);

      let start = min;
      let end = max;

      if (range !== "*") {
        if (range.includes("-")) {
          const [s, e] = range.split("-").map(Number);
          start = s;
          end = e;
        } else {
          start = parseInt(range, 10);
        }
      }

      for (let i = start; i <= end; i += step) {
        if (i >= min && i <= max) values.add(i);
      }
    } else if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end)) throw new Error(`Invalid range: ${part}`);
      for (let i = start; i <= end; i++) {
        if (i >= min && i <= max) values.add(i);
      }
    } else {
      const val = parseInt(part, 10);
      if (isNaN(val)) throw new Error(`Invalid value: ${part}`);
      if (val >= min && val <= max) values.add(val);
    }
  }

  return { values };
}

interface ParsedCron {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
}

/**
 * Parse a full 5-field cron expression.
 */
function parseCron(expression: string): ParsedCron {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Cron expression must have 5 fields, got ${fields.length}`);
  }

  return {
    minutes: parseField(fields[0], 0, 59).values,
    hours: parseField(fields[1], 0, 23).values,
    daysOfMonth: parseField(fields[2], 1, 31).values,
    months: parseField(fields[3], 1, 12).values,
    daysOfWeek: parseField(fields[4], 0, 6).values,
  };
}

/**
 * Get the number of days in a month/year.
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Convert a Date to the given timezone by computing its local components.
 */
function toTimezoneComponents(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || "";

  const year = parseInt(get("year"), 10);
  const month = parseInt(get("month"), 10);
  const day = parseInt(get("day"), 10);
  let hour = parseInt(get("hour"), 10);
  // Intl with hour12:false can return 24 for midnight
  if (hour === 24) hour = 0;
  const minute = parseInt(get("minute"), 10);

  const weekdayStr = get("weekday");
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = weekdayMap[weekdayStr] ?? 0;

  return { year, month, day, hour, minute, dayOfWeek };
}

/**
 * Create a Date from timezone-local components.
 * We approximate by creating a UTC date, then adjusting based on the offset.
 */
function fromTimezoneComponents(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  // Create a rough UTC date
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  // Find the offset by checking what local time this UTC date corresponds to
  const local = toTimezoneComponents(utcDate, timezone);
  const localMinutes = local.hour * 60 + local.minute;
  const targetMinutes = hour * 60 + minute;
  let diffMinutes = targetMinutes - localMinutes;

  // Handle day boundary crossing
  if (local.day !== day) {
    // If the local day is ahead, we need to go back
    if (local.day > day || (local.month > month) || (local.year > year)) {
      diffMinutes -= 24 * 60;
    } else {
      diffMinutes += 24 * 60;
    }
  }

  const adjusted = new Date(utcDate.getTime() - diffMinutes * 60 * 1000);

  // Verify and fine-tune
  const verify = toTimezoneComponents(adjusted, timezone);
  if (verify.hour !== hour || verify.minute !== minute) {
    // Try small adjustments for DST transitions
    for (let offset = -120; offset <= 120; offset += 1) {
      const candidate = new Date(adjusted.getTime() + offset * 60 * 1000);
      const check = toTimezoneComponents(candidate, timezone);
      if (
        check.year === year &&
        check.month === month &&
        check.day === day &&
        check.hour === hour &&
        check.minute === minute
      ) {
        return candidate;
      }
    }
  }

  return adjusted;
}

/**
 * Parse a cron expression and compute the next run time.
 * Supports standard 5-field cron: minute hour day-of-month month day-of-week
 *
 * @param cronExpression - Standard 5-field cron expression
 * @param timezone - IANA timezone name (e.g., "Asia/Tokyo")
 * @param after - Start searching from this date (defaults to now)
 * @returns The next matching Date, or null if none found within 2 years
 */
export function getNextRunTime(
  cronExpression: string,
  timezone: string,
  after?: Date,
): Date | null {
  const cron = parseCron(cronExpression);
  const start = after ?? new Date();

  // Start from the next minute after 'start'
  const comp = toTimezoneComponents(start, timezone);
  let year = comp.year;
  let month = comp.month;
  let day = comp.day;
  let hour = comp.hour;
  let minute = comp.minute + 1;

  // Normalize overflow
  if (minute > 59) {
    minute = 0;
    hour++;
  }
  if (hour > 23) {
    hour = 0;
    day++;
  }

  const maxYear = year + 2;

  // Check if the cron fields for dom and dow are both restricted
  const allDom = cron.daysOfMonth.size === 31;
  const allDow = cron.daysOfWeek.size === 7;

  while (year <= maxYear) {
    // Month check
    if (!cron.months.has(month)) {
      month = findNext(cron.months, month);
      if (month === -1) {
        year++;
        month = findNext(cron.months, 1);
        if (month === -1) return null;
      }
      day = 1;
      hour = 0;
      minute = 0;
      continue;
    }

    // Day check
    const maxDay = daysInMonth(year, month);
    if (day > maxDay) {
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
      day = 1;
      hour = 0;
      minute = 0;
      continue;
    }

    // Day-of-month and day-of-week check
    // Standard cron: if both dom and dow are restricted (not *),
    // then either matching is sufficient (OR logic).
    // If only one is restricted, it must match.
    const date = fromTimezoneComponents(year, month, day, 0, 0, timezone);
    const dateComp = toTimezoneComponents(date, timezone);
    const currentDow = dateComp.dayOfWeek;

    const domMatch = cron.daysOfMonth.has(day);
    const dowMatch = cron.daysOfWeek.has(currentDow);

    let dayOk: boolean;
    if (!allDom && !allDow) {
      // Both restricted: OR logic (standard cron behavior)
      dayOk = domMatch || dowMatch;
    } else {
      // One or both unrestricted: AND logic
      dayOk = domMatch && dowMatch;
    }

    if (!dayOk) {
      day++;
      hour = 0;
      minute = 0;
      continue;
    }

    // Hour check
    if (!cron.hours.has(hour)) {
      const nextHour = findNext(cron.hours, hour);
      if (nextHour === -1 || nextHour < hour) {
        day++;
        hour = 0;
        minute = 0;
        continue;
      }
      hour = nextHour;
      minute = 0;
      continue;
    }

    // Minute check
    if (!cron.minutes.has(minute)) {
      const nextMinute = findNext(cron.minutes, minute);
      if (nextMinute === -1 || nextMinute < minute) {
        hour++;
        if (hour > 23) {
          day++;
          hour = 0;
        }
        minute = 0;
        continue;
      }
      minute = nextMinute;
    }

    // All fields match
    return fromTimezoneComponents(year, month, day, hour, minute, timezone);
  }

  return null;
}

/**
 * Find the next value >= target in the set, or -1 if none.
 */
function findNext(values: Set<number>, target: number): number {
  let min = -1;
  for (const v of values) {
    if (v >= target && (min === -1 || v < min)) {
      min = v;
    }
  }
  return min;
}

/**
 * Get a human-readable description of a cron expression in Japanese.
 */
export function describeCron(cronExpression: string): string {
  try {
    const fields = cronExpression.trim().split(/\s+/);
    if (fields.length !== 5) return cronExpression;

    const [minuteField, hourField, domField, monthField, dowField] = fields;

    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

    // Parse time
    const minute = minuteField === "*" ? null : parseInt(minuteField, 10);
    const hour = hourField === "*" ? null : parseInt(hourField, 10);
    const timeStr =
      hour !== null && minute !== null
        ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
        : hour !== null
          ? `${hour}時台`
          : "";

    // Every N minutes
    if (minuteField.startsWith("*/") && hourField === "*" && domField === "*" && monthField === "*" && dowField === "*") {
      const step = parseInt(minuteField.split("/")[1], 10);
      return `${step}分ごと`;
    }

    // Every N hours
    if (minuteField !== "*" && hourField.startsWith("*/") && domField === "*" && monthField === "*" && dowField === "*") {
      const step = parseInt(hourField.split("/")[1], 10);
      return `${step}時間ごと (${String(minute).padStart(2, "0")}分)`;
    }

    // Daily
    if (domField === "*" && monthField === "*" && dowField === "*") {
      return `${timeStr ? `毎日 ${timeStr}` : "毎日"}`;
    }

    // Weekly
    if (domField === "*" && monthField === "*" && dowField !== "*") {
      const dowValues = parseField(dowField, 0, 6).values;
      const dowArr = Array.from(dowValues).sort((a, b) => a - b);

      if (dowArr.length === 1) {
        return `毎週${dayNames[dowArr[0]]}曜日 ${timeStr}`;
      }
      if (dowArr.length === 5 && !dowArr.includes(0) && !dowArr.includes(6)) {
        return `平日 ${timeStr}`;
      }
      if (dowArr.length === 2 && dowArr.includes(0) && dowArr.includes(6)) {
        return `週末 ${timeStr}`;
      }
      const dayList = dowArr.map((d) => dayNames[d]).join("・");
      return `毎週${dayList}曜日 ${timeStr}`;
    }

    // Monthly
    if (domField !== "*" && monthField === "*" && dowField === "*") {
      const domValues = parseField(domField, 1, 31).values;
      const domArr = Array.from(domValues).sort((a, b) => a - b);

      if (domArr.length === 1) {
        return `毎月${domArr[0]}日 ${timeStr}`;
      }
      const dayList = domArr.join("・");
      return `毎月${dayList}日 ${timeStr}`;
    }

    // Specific month
    if (monthField !== "*") {
      const monthValues = parseField(monthField, 1, 12).values;
      const monthArr = Array.from(monthValues).sort((a, b) => a - b);
      const monthNames = monthArr.map((m) => `${m}月`).join("・");

      if (domField !== "*") {
        const domValues = parseField(domField, 1, 31).values;
        const domArr = Array.from(domValues).sort((a, b) => a - b);
        return `${monthNames}${domArr[0]}日 ${timeStr}`;
      }

      return `${monthNames} ${timeStr}`;
    }

    return cronExpression;
  } catch {
    return cronExpression;
  }
}

/**
 * Schedule configuration for building cron expressions
 * from a user-friendly interface.
 */
export interface ScheduleConfig {
  frequency: "daily" | "weekly" | "monthly" | "custom";
  time: string;          // HH:MM format
  daysOfWeek?: number[]; // 0-6 (Sun-Sat) for weekly
  dayOfMonth?: number;   // 1-31 for monthly
  customCron?: string;   // raw cron for custom
}

/**
 * Build a cron expression from a user-friendly schedule config.
 */
export function buildCronExpression(config: ScheduleConfig): string {
  if (config.frequency === "custom" && config.customCron) {
    return config.customCron;
  }

  const [hourStr, minuteStr] = config.time.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  switch (config.frequency) {
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly": {
      const days = config.daysOfWeek?.length
        ? config.daysOfWeek.sort((a, b) => a - b).join(",")
        : "1"; // Default to Monday
      return `${minute} ${hour} * * ${days}`;
    }
    case "monthly": {
      const dom = config.dayOfMonth ?? 1;
      return `${minute} ${hour} ${dom} * *`;
    }
    default:
      return `${minute} ${hour} * * *`;
  }
}

/**
 * Validate a cron expression.
 * Returns true if the expression is valid.
 */
export function isValidCron(expression: string): boolean {
  try {
    const fields = expression.trim().split(/\s+/);
    if (fields.length !== 5) return false;

    // Try parsing each field
    parseField(fields[0], 0, 59);
    parseField(fields[1], 0, 23);
    parseField(fields[2], 1, 31);
    parseField(fields[3], 1, 12);
    parseField(fields[4], 0, 6);

    return true;
  } catch {
    return false;
  }
}

/**
 * Get the next N run times for display.
 *
 * @param cronExpression - Standard 5-field cron expression
 * @param timezone - IANA timezone name
 * @param count - Number of run times to compute
 * @returns Array of next run Dates
 */
export function getNextRunTimes(
  cronExpression: string,
  timezone: string,
  count: number,
): Date[] {
  const results: Date[] = [];
  let current: Date | null = new Date();

  for (let i = 0; i < count; i++) {
    current = getNextRunTime(cronExpression, timezone, current);
    if (!current) break;
    results.push(current);
  }

  return results;
}
