import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { createDb } from "@/db";
import { session, users } from "@/db/schema";
import { createStripeClient, getPlansWithPriceIds } from "@/lib/stripe/config";
import {
  getOrCreateCustomer,
  createCheckoutSession,
} from "@/lib/stripe/subscription";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("better-auth.session_token")?.value;
  if (!sessionToken) return null;

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  const rows = await db
    .select({ userId: session.userId })
    .from(session)
    .where(
      and(
        eq(session.token, sessionToken),
        sql`${session.expiresAt} > ${Math.floor(Date.now() / 1000)}`,
      ),
    )
    .limit(1);

  if (!rows[0]) return null;

  const userRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, rows[0].userId))
    .limit(1);

  return userRows[0] ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as { plan?: string };
    const plan = body.plan;

    if (plan !== "pro" && plan !== "business") {
      return NextResponse.json(
        { error: "無効なプランです" },
        { status: 400 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);
    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    const plans = getPlansWithPriceIds(env);

    const priceId = plans[plan].priceId;
    if (!priceId) {
      return NextResponse.json(
        { error: "プランの価格IDが設定されていません" },
        { status: 500 },
      );
    }

    const customerId = await getOrCreateCustomer(
      stripe,
      user.id,
      user.email,
      db,
    );

    const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const checkoutSession = await createCheckoutSession(stripe, {
      customerId,
      priceId,
      successUrl: `${appUrl}/settings/billing?success=true`,
      cancelUrl: `${appUrl}/settings/billing`,
      userId: user.id,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("POST /api/stripe/checkout error:", error);
    return NextResponse.json(
      { error: "チェックアウトセッションの作成に失敗しました" },
      { status: 500 },
    );
  }
}
