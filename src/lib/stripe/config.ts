import Stripe from "stripe";

export function createStripeClient(apiKey: string): Stripe {
  return new Stripe(apiKey, { apiVersion: "2026-03-25.dahlia" });
}

export const PLANS = {
  free: {
    name: "Free",
    nameJa: "フリー",
    price: 0,
    priceId: null,
    limits: {
      accounts: 1,
      postsPerMonth: 30,
      scheduledPosts: 5,
      aiGenerations: 10,
      templates: 5,
      analytics: "basic" as const,
      reports: "none" as const,
      replyManagement: "readonly" as const,
    },
  },
  pro: {
    name: "Pro",
    nameJa: "プロ",
    price: 1980,
    priceId: null as string | null, // Set from env at runtime
    limits: {
      accounts: 3,
      postsPerMonth: -1,
      scheduledPosts: -1,
      aiGenerations: 100,
      templates: 50,
      analytics: "full" as const,
      reports: "weekly" as const,
      replyManagement: "full" as const,
    },
  },
  business: {
    name: "Business",
    nameJa: "ビジネス",
    price: 4980,
    priceId: null as string | null, // Set from env at runtime
    limits: {
      accounts: 10,
      postsPerMonth: -1,
      scheduledPosts: -1,
      aiGenerations: -1,
      templates: -1,
      analytics: "full" as const,
      reports: "full" as const,
      replyManagement: "full" as const,
    },
  },
} as const;

/**
 * Returns PLANS with priceId populated from environment variables.
 */
export function getPlansWithPriceIds(env: {
  STRIPE_PRO_PRICE_ID: string;
  STRIPE_BUSINESS_PRICE_ID: string;
}) {
  return {
    free: PLANS.free,
    pro: { ...PLANS.pro, priceId: env.STRIPE_PRO_PRICE_ID },
    business: { ...PLANS.business, priceId: env.STRIPE_BUSINESS_PRICE_ID },
  };
}

export type PlanType = keyof typeof PLANS;
export type PlanLimits = (typeof PLANS)[PlanType]["limits"];

/**
 * Resolve a Stripe price ID to its plan type.
 */
export function getPlanByPriceId(
  priceId: string,
  env: { STRIPE_PRO_PRICE_ID: string; STRIPE_BUSINESS_PRICE_ID: string },
): PlanType | null {
  if (priceId === env.STRIPE_PRO_PRICE_ID) return "pro";
  if (priceId === env.STRIPE_BUSINESS_PRICE_ID) return "business";
  return null;
}
