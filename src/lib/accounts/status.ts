export type AccountTokenStatus = "valid" | "expiring_soon" | "expired";

export function getTokenStatus(
  expiresAt: Date,
  warningWindowDays = 3,
): AccountTokenStatus {
  const now = new Date();
  const warningThreshold = new Date(
    now.getTime() + warningWindowDays * 24 * 60 * 60 * 1000,
  );

  if (expiresAt < now) {
    return "expired";
  }

  if (expiresAt < warningThreshold) {
    return "expiring_soon";
  }

  return "valid";
}
