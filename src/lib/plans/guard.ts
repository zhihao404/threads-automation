import { NextResponse } from "next/server";
import { checkLimit, getUserPlan } from "./limits";
import { PLANS } from "@/lib/stripe/config";
import type { Database } from "@/db";

/**
 * Reusable guard for API routes that need plan limit checking.
 * Returns a NextResponse error if the limit is exceeded, null if allowed.
 */
export async function guardPlanLimit(
  db: Database,
  userId: string,
  type: string,
): Promise<NextResponse | null> {
  const { allowed, usage } = await checkLimit(db, userId, type);
  if (!allowed) {
    return NextResponse.json(
      {
        error: "プランの上限に達しました",
        code: "PLAN_LIMIT_EXCEEDED",
        usage,
        upgradeUrl: "/settings/billing",
      },
      { status: 403 },
    );
  }
  return null;
}

// Feature access levels per plan
type FeatureValue = string;

const FEATURE_KEY_MAP: Record<string, keyof (typeof PLANS)["free"]["limits"]> = {
  analytics: "analytics",
  reports: "reports",
  replyManagement: "replyManagement",
};

/**
 * Check if user has access to a feature based on plan.
 * For string-based limits like analytics, reports, replyManagement.
 *
 * @param requiredLevel - The minimum required access level.
 *   For reports: "weekly" or "full"
 *   For analytics: "full"
 *   For replyManagement: "full"
 */
export async function guardFeatureAccess(
  db: Database,
  userId: string,
  feature: string,
  requiredLevel?: string,
): Promise<NextResponse | null> {
  const plan = await getUserPlan(db, userId);
  const planConfig = PLANS[plan];

  const limitKey = FEATURE_KEY_MAP[feature];
  if (!limitKey) {
    // Unknown feature - allow
    return null;
  }

  const featureValue = planConfig.limits[limitKey] as FeatureValue;

  // "none" means no access at all
  if (featureValue === "none") {
    return NextResponse.json(
      {
        error: "この機能はご利用のプランではご利用いただけません",
        code: "FEATURE_NOT_AVAILABLE",
        feature,
        currentPlan: plan,
        upgradeUrl: "/settings/billing",
      },
      { status: 403 },
    );
  }

  // If a specific level is required, check it
  if (requiredLevel) {
    const accessLevels: Record<string, number> = {
      none: 0,
      readonly: 1,
      basic: 2,
      weekly: 3,
      full: 4,
    };

    const currentLevel = accessLevels[featureValue] ?? 0;
    const neededLevel = accessLevels[requiredLevel] ?? 0;

    if (currentLevel < neededLevel) {
      return NextResponse.json(
        {
          error: "この機能はご利用のプランではご利用いただけません",
          code: "FEATURE_NOT_AVAILABLE",
          feature,
          currentPlan: plan,
          requiredLevel,
          currentLevel: featureValue,
          upgradeUrl: "/settings/billing",
        },
        { status: 403 },
      );
    }
  }

  return null;
}
