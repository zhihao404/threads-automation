import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { postTemplates, session } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { renderTemplateSchema } from "@/lib/validations/template";
import {
  extractVariables,
  renderTemplate,
  getBuiltinVariableValues,
} from "@/lib/templates/render";
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

export async function POST(
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
    const parseResult = renderTemplateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "入力内容に誤りがあります", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { variables: userVariables } = parseResult.data;
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

    // Merge built-in variables with user-provided variables (user takes precedence)
    const builtinValues = getBuiltinVariableValues();
    const allVariables = { ...builtinValues, ...userVariables };

    const rendered = renderTemplate(template.content, allVariables);
    const variables = extractVariables(template.content);

    return NextResponse.json({
      rendered,
      charCount: rendered.length,
      variables,
    });
  } catch (error) {
    console.error("POST /api/templates/[id]/render error:", error);
    return NextResponse.json(
      { error: "テンプレートのレンダリングに失敗しました" },
      { status: 500 }
    );
  }
}
