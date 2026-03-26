import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { postTemplates, session } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { updateTemplateSchema } from "@/lib/validations/template";
import { cookies } from "next/headers";

async function getAuthenticatedUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("better-auth.session_token")?.value;
  if (!sessionToken) return null;

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  const sessions = await db
    .select({ userId: session.userId })
    .from(session)
    .where(
      and(
        eq(session.token, sessionToken),
        sql`${session.expiresAt} > ${Math.floor(Date.now() / 1000)}`
      )
    )
    .limit(1);

  return sessions[0]?.userId ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const rows = await db
      .select()
      .from(postTemplates)
      .where(eq(postTemplates.id, id))
      .limit(1);

    const template = rows[0];
    if (!template) {
      return NextResponse.json(
        { error: "テンプレートが見つかりません" },
        { status: 404 }
      );
    }

    if (template.userId !== userId) {
      return NextResponse.json(
        { error: "アクセス権がありません" },
        { status: 403 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("GET /api/templates/[id] error:", error);
    return NextResponse.json(
      { error: "テンプレートの取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parseResult = updateTemplateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "入力内容に誤りがあります", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Verify ownership
    const rows = await db
      .select()
      .from(postTemplates)
      .where(eq(postTemplates.id, id))
      .limit(1);

    const template = rows[0];
    if (!template) {
      return NextResponse.json(
        { error: "テンプレートが見つかりません" },
        { status: 404 }
      );
    }

    if (template.userId !== userId) {
      return NextResponse.json(
        { error: "アクセス権がありません" },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.content !== undefined) updateData.content = input.content;
    if (input.category !== undefined) updateData.category = input.category || null;
    if (input.mediaType !== undefined) updateData.mediaType = input.mediaType;

    await db
      .update(postTemplates)
      .set(updateData)
      .where(eq(postTemplates.id, id));

    const updated = await db
      .select()
      .from(postTemplates)
      .where(eq(postTemplates.id, id))
      .limit(1);

    return NextResponse.json({ template: updated[0] });
  } catch (error) {
    console.error("PUT /api/templates/[id] error:", error);
    return NextResponse.json(
      { error: "テンプレートの更新に失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Verify ownership
    const rows = await db
      .select()
      .from(postTemplates)
      .where(eq(postTemplates.id, id))
      .limit(1);

    const template = rows[0];
    if (!template) {
      return NextResponse.json(
        { error: "テンプレートが見つかりません" },
        { status: 404 }
      );
    }

    if (template.userId !== userId) {
      return NextResponse.json(
        { error: "アクセス権がありません" },
        { status: 403 }
      );
    }

    await db.delete(postTemplates).where(eq(postTemplates.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/templates/[id] error:", error);
    return NextResponse.json(
      { error: "テンプレートの削除に失敗しました" },
      { status: 500 }
    );
  }
}
