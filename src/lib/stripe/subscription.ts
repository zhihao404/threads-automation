import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import type { Database } from "@/db";
import { subscriptions, users } from "@/db/schema";
import type { PlanType } from "./config";

/**
 * Get or create a Stripe customer for a user.
 * Checks the subscriptions table first; if no record exists, creates a
 * Stripe customer and inserts a free-tier subscription row.
 */
export async function getOrCreateCustomer(
  stripe: Stripe,
  userId: string,
  email: string,
  db: Database,
): Promise<string> {
  // Check for existing subscription record
  const existing = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (existing[0]?.stripeCustomerId) {
    return existing[0].stripeCustomerId;
  }

  // Look up user name for Stripe metadata
  const userRows = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: userRows[0]?.name ?? undefined,
    metadata: { userId },
  });

  const now = new Date();

  // Insert free subscription record
  await db.insert(subscriptions).values({
    id: ulid(),
    userId,
    stripeCustomerId: customer.id,
    plan: "free",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  return customer.id;
}

/**
 * Get the user's current plan. Defaults to "free" if no subscription exists.
 */
export async function getUserPlan(
  db: Database,
  userId: string,
): Promise<PlanType> {
  const rows = await db
    .select({ plan: subscriptions.plan, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  const sub = rows[0];
  if (!sub) return "free";

  // Only count active or trialing subscriptions for paid plans
  if (sub.status === "active" || sub.status === "trialing") {
    return sub.plan as PlanType;
  }

  return "free";
}

/**
 * Get the full subscription record for a user.
 */
export async function getUserSubscription(
  db: Database,
  userId: string,
) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Create a Stripe Checkout session for upgrading to a paid plan.
 */
export async function createCheckoutSession(
  stripe: Stripe,
  params: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    userId: string;
  },
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: "subscription",
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      userId: params.userId,
    },
    subscription_data: {
      metadata: {
        userId: params.userId,
      },
    },
    allow_promotion_codes: true,
  });
}

/**
 * Create a Stripe Customer Portal session for managing an existing subscription.
 */
export async function createPortalSession(
  stripe: Stripe,
  customerId: string,
  returnUrl: string,
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
