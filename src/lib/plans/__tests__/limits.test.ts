import { describe, it, expect } from "vitest";
import { getCurrentPeriod } from "../limits";
import { PLANS, getPlanByPriceId, getPlansWithPriceIds } from "@/lib/stripe/config";

// =============================================================================
// getCurrentPeriod (pure function, no DB)
// =============================================================================

describe("getCurrentPeriod", () => {
  it("returns start and end as YYYY-MM-DD strings", () => {
    const period = getCurrentPeriod();
    expect(period.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(period.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("start is the 1st of the current month", () => {
    const period = getCurrentPeriod();
    expect(period.start.endsWith("-01")).toBe(true);
  });

  it("end is within the current month", () => {
    const period = getCurrentPeriod();
    const endDay = parseInt(period.end.split("-")[2]!, 10);
    expect(endDay).toBeGreaterThanOrEqual(28);
    expect(endDay).toBeLessThanOrEqual(31);
  });

  it("start and end share the same year and month", () => {
    const period = getCurrentPeriod();
    const startParts = period.start.split("-");
    const endParts = period.end.split("-");
    expect(startParts[0]).toBe(endParts[0]); // year
    expect(startParts[1]).toBe(endParts[1]); // month
  });
});

// =============================================================================
// PLANS config (pure data, no DB)
// =============================================================================

describe("PLANS", () => {
  it("has free, pro, and business plans", () => {
    expect(PLANS).toHaveProperty("free");
    expect(PLANS).toHaveProperty("pro");
    expect(PLANS).toHaveProperty("business");
  });

  it("free plan has price 0", () => {
    expect(PLANS.free.price).toBe(0);
  });

  it("pro plan has positive price", () => {
    expect(PLANS.pro.price).toBeGreaterThan(0);
  });

  it("business plan has price greater than pro", () => {
    expect(PLANS.business.price).toBeGreaterThan(PLANS.pro.price);
  });

  it("free plan has expected limits", () => {
    const limits = PLANS.free.limits;
    expect(limits.accounts).toBe(1);
    expect(limits.postsPerMonth).toBe(30);
    expect(limits.scheduledPosts).toBe(5);
    expect(limits.aiGenerations).toBe(10);
    expect(limits.templates).toBe(5);
    expect(limits.analytics).toBe("basic");
    expect(limits.reports).toBe("none");
    expect(limits.replyManagement).toBe("readonly");
  });

  it("pro plan has higher limits than free", () => {
    expect(PLANS.pro.limits.accounts).toBeGreaterThan(PLANS.free.limits.accounts);
    expect(PLANS.pro.limits.aiGenerations).toBeGreaterThan(PLANS.free.limits.aiGenerations);
    expect(PLANS.pro.limits.templates).toBeGreaterThan(PLANS.free.limits.templates);
  });

  it("pro plan has unlimited posts (-1)", () => {
    expect(PLANS.pro.limits.postsPerMonth).toBe(-1);
    expect(PLANS.pro.limits.scheduledPosts).toBe(-1);
  });

  it("business plan has unlimited everything numeric", () => {
    expect(PLANS.business.limits.postsPerMonth).toBe(-1);
    expect(PLANS.business.limits.scheduledPosts).toBe(-1);
    expect(PLANS.business.limits.aiGenerations).toBe(-1);
    expect(PLANS.business.limits.templates).toBe(-1);
  });

  it("business plan has highest account limit", () => {
    expect(PLANS.business.limits.accounts).toBeGreaterThan(PLANS.pro.limits.accounts);
  });

  it("all plans have Japanese names", () => {
    expect(PLANS.free.nameJa).toBeTruthy();
    expect(PLANS.pro.nameJa).toBeTruthy();
    expect(PLANS.business.nameJa).toBeTruthy();
  });
});

// =============================================================================
// getPlanByPriceId (pure function)
// =============================================================================

describe("getPlanByPriceId", () => {
  const env = {
    STRIPE_PRO_PRICE_ID: "price_pro_123",
    STRIPE_BUSINESS_PRICE_ID: "price_biz_456",
  };

  it("returns 'pro' for pro price ID", () => {
    expect(getPlanByPriceId("price_pro_123", env)).toBe("pro");
  });

  it("returns 'business' for business price ID", () => {
    expect(getPlanByPriceId("price_biz_456", env)).toBe("business");
  });

  it("returns null for unknown price ID", () => {
    expect(getPlanByPriceId("price_unknown", env)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getPlanByPriceId("", env)).toBeNull();
  });
});

// =============================================================================
// getPlansWithPriceIds (pure function)
// =============================================================================

describe("getPlansWithPriceIds", () => {
  const env = {
    STRIPE_PRO_PRICE_ID: "price_pro_abc",
    STRIPE_BUSINESS_PRICE_ID: "price_biz_xyz",
  };

  it("populates pro priceId from env", () => {
    const plans = getPlansWithPriceIds(env);
    expect(plans.pro.priceId).toBe("price_pro_abc");
  });

  it("populates business priceId from env", () => {
    const plans = getPlansWithPriceIds(env);
    expect(plans.business.priceId).toBe("price_biz_xyz");
  });

  it("keeps free plan unchanged", () => {
    const plans = getPlansWithPriceIds(env);
    expect(plans.free).toBe(PLANS.free);
  });

  it("preserves all plan properties", () => {
    const plans = getPlansWithPriceIds(env);
    expect(plans.pro.name).toBe("Pro");
    expect(plans.pro.price).toBe(PLANS.pro.price);
    expect(plans.business.name).toBe("Business");
    expect(plans.business.price).toBe(PLANS.business.price);
  });
});
