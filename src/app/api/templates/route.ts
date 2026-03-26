import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { postTemplates, session } from "@/db/schema";
import { eq, and, desc, sql, like, or } from "drizzle-orm";
import { ulid } from "ulid";
import { createTemplateSchema } from "@/lib/validations/template";
import { cookies } from "next/headers";
import { guardPlanLimit } from "@/lib/plans/guard";

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

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const conditions = [eq(postTemplates.userId, userId)];

    if (category) {
      conditions.push(eq(postTemplates.category, category));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          like(postTemplates.name, searchPattern),
          like(postTemplates.content, searchPattern)
        )!
      );
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(postTemplates)
      .where(whereClause);

    const total = countResult[0]?.count ?? 0;

    // Get templates
    const templates = await db
      .select()
      .from(postTemplates)
      .where(whereClause)
      .orderBy(desc(postTemplates.updatedAt))
      .limit(limit)
      .offset(offset);

    // Get distinct categories for this user
    const categoryRows = await db
      .select({ category: postTemplates.category })
      .from(postTemplates)
      .where(eq(postTemplates.userId, userId))
      .groupBy(postTemplates.category);

    const categories = categoryRows
      .map((r) => r.category)
      .filter((c): c is string => c !== null && c !== "");

    return NextResponse.json({ templates, total, categories });
  } catch (error) {
    console.error("GET /api/templates error:", error);
    return NextResponse.json(
      { error: "テンプレートの取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parseResult = createTemplateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "入力内容に誤りがあります", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Check plan limit for template creation
    const limitResponse = await guardPlanLimit(db, userId, "template");
    if (limitResponse) return limitResponse;

    const now = new Date();
    const templateId = ulid();

    await db.insert(postTemplates).values({
      id: templateId,
      userId,
      name: input.name,
      content: input.content,
      category: input.category || null,
      mediaType: input.mediaType,
      createdAt: now,
      updatedAt: now,
    });

    const created = await db
      .select()
      .from(postTemplates)
      .where(eq(postTemplates.id, templateId))
      .limit(1);

    return NextResponse.json(
      { template: created[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/templates error:", error);
    return NextResponse.json(
      { error: "テンプレートの作成に失敗しました" },
      { status: 500 }
    );
  }
}
