/**
 * Formats a Date to YYYY-MM-DD string.
 * Used across API routes, services, and workers for consistent date formatting.
 */
export function formatDateToYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parses a period string like "7d", "30d", "90d" into the number of days.
 * Clamps between 1 and 365 days. Defaults to 30 if parsing fails.
 */
export function parsePeriodDays(period: string): number {
  const match = period.match(/^(\d+)d$/);
  if (match?.[1]) {
    const days = parseInt(match[1], 10);
    return Math.min(365, Math.max(1, days));
  }
  return 30;
}
