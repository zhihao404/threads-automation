import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import Stripe from "stripe";
import { createDb } from "@/db";
import { subscriptions } from "@/db/schema";
import { createStripeClient, getPlanByPriceId } from "@/lib/stripe/config";

export const runtime = "edge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract billing period dates from a Stripe Subscription.
 * In SDK v21+, current_period_start/end live on SubscriptionItem, not Subscription.
 */
function extractPeriod(sub: Stripe.Subscription): {
  periodStart: Date | null;
  periodEnd: Date | null;
} {
  const item = sub.items.data[0];
  if (!item) return { periodStart: null, periodEnd: null };
  return {
    periodStart: new Date(item.current_period_start * 1000),
    periodEnd: new Date(item.current_period_end * 1000),
  };
}

/**
 * Extract the subscription ID from an Invoice object.
 * In SDK v21+, the subscription reference is in parent.subscription_details.
 */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const details = invoice.parent?.subscription_details;
  if (!details) return null;
  const sub = details.subscription;
  if (typeof sub === "string") return sub;
  if (sub && typeof sub === "object" && "id" in sub) return sub.id;
  return null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const stripe = createStripeClient(env.STRIPE_SECRET_KEY);

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 },
    );
  }

  const db = createDb(env.DB);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event.data.object, stripe, db, env);
        break;
      }
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(event.data.object, db, env);
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(event.data.object, db);
        break;
      }
      case "invoice.payment_failed": {
        await handlePaymentFailed(event.data.object, db);
        break;
      }
      case "invoice.paid": {
        await handleInvoicePaid(event.data.object, db);
        break;
      }
      default: {
        // Unhandled event type -- log but don't error
        console.log(`Unhandled Stripe event: ${event.type}`);
      }
    }
  } catch (error) {
    console.error(`Error handling Stripe event ${event.type}:`, error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  checkoutSession: Stripe.Checkout.Session,
  stripe: Stripe,
  db: ReturnType<typeof createDb>,
  env: CloudflareEnv,
) {
  const userId = checkoutSession.metadata?.userId;
  const customerId =
    typeof checkoutSession.customer === "string"
      ? checkoutSession.customer
      : checkoutSession.customer?.id;
  const subscriptionId =
    typeof checkoutSession.subscription === "string"
      ? checkoutSession.subscription
      : checkoutSession.subscription?.id;

  if (!userId || !customerId || !subscriptionId) {
    console.error(
      "checkout.session.completed: missing userId, customerId, or subscriptionId",
    );
    return;
  }

  // Retrieve subscription details from Stripe
  const stripeSubscription =
    await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = stripeSubscription.items.data[0]?.price?.id;
  const plan = priceId ? getPlanByPriceId(priceId, env) : null;

  if (!plan) {
    console.error(
      "checkout.session.completed: could not resolve plan from priceId:",
      priceId,
    );
    return;
  }

  const now = new Date();
  const { periodStart, periodEnd } = extractPeriod(stripeSubscription);

  // Check if user already has a subscription record
  const existing = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (existing[0]) {
    // Update existing record
    await db
      .update(subscriptions)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId ?? null,
        plan,
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existing[0].id));
  } else {
    // Insert new record
    await db.insert(subscriptions).values({
      id: ulid(),
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId ?? null,
      plan,
      status: "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function handleSubscriptionUpdated(
  stripeSubscription: Stripe.Subscription,
  db: ReturnType<typeof createDb>,
  env: CloudflareEnv,
) {
  const subscriptionId = stripeSubscription.id;
  const priceId = stripeSubscription.items.data[0]?.price?.id;
  const plan = priceId ? getPlanByPriceId(priceId, env) : null;

  // Map Stripe status to our status enum
  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    trialing: "trialing",
    incomplete: "incomplete",
    incomplete_expired: "canceled",
    unpaid: "past_due",
    paused: "canceled",
  };
  const status = statusMap[stripeSubscription.status] ?? "active";
  const { periodStart, periodEnd } = extractPeriod(stripeSubscription);

  const now = new Date();

  // Find subscription by Stripe subscription ID
  const existing = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(subscriptions)
      .set({
        ...(plan ? { plan } : {}),
        ...(priceId ? { stripePriceId: priceId } : {}),
        status: status as
          | "active"
          | "canceled"
          | "past_due"
          | "trialing"
          | "incomplete",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existing[0].id));
  }
}

async function handleSubscriptionDeleted(
  stripeSubscription: Stripe.Subscription,
  db: ReturnType<typeof createDb>,
) {
  const subscriptionId = stripeSubscription.id;
  const now = new Date();

  const existing = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (existing[0]) {
    // Revert to free plan
    await db
      .update(subscriptions)
      .set({
        plan: "free",
        status: "canceled",
        stripeSubscriptionId: null,
        stripePriceId: null,
        cancelAtPeriodEnd: false,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existing[0].id));
  }
}

async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  db: ReturnType<typeof createDb>,
) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const now = new Date();
  const existing = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(subscriptions)
      .set({
        status: "past_due",
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existing[0].id));
  }
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  db: ReturnType<typeof createDb>,
) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const now = new Date();
  const existing = await db
    .select({ id: subscriptions.id, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (existing[0] && existing[0].status === "past_due") {
    await db
      .update(subscriptions)
      .set({
        status: "active",
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existing[0].id));
  }
}
