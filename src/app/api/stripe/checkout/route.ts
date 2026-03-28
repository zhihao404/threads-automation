import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { createStripeClient, getPlansWithPriceIds } from "@/lib/stripe/config";
import {
  getOrCreateCustomer,
  createCheckoutSession,
} from "@/lib/stripe/subscription";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

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
