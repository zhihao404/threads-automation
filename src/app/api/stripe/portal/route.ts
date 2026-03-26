import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";

import { createStripeClient } from "@/lib/stripe/config";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import {
  getUserSubscription,
  createPortalSession,
} from "@/lib/stripe/subscription";

export async function POST() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);
    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);

    const subscription = await getUserSubscription(db, userId);
    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: "サブスクリプションが見つかりません" },
        { status: 404 },
      );
    }

    const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const portalSession = await createPortalSession(
      stripe,
      subscription.stripeCustomerId,
      `${appUrl}/settings/billing`,
    );

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("POST /api/stripe/portal error:", error);
    return NextResponse.json(
      { error: "ポータルセッションの作成に失敗しました" },
      { status: 500 },
    );
  }
}
