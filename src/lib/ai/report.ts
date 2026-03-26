import Anthropic from "@anthropic-ai/sdk";

export interface ReportMetrics {
  totalViews: number;
  totalLikes: number;
  totalReplies: number;
  totalReposts: number;
  totalQuotes: number;
  totalClicks: number;
  postsPublished: number;
  followersStart: number;
  followersEnd: number;
  followerChange: number;
  avgEngagementRate: number;
}

export interface ReportData {
  accountUsername: string;
  periodStart: string;
  periodEnd: string;
  type: "weekly" | "monthly";
  metrics: ReportMetrics;
  previousMetrics: ReportMetrics;
  topPosts: Array<{
    content: string;
    views: number;
    likes: number;
    replies: number;
    engagementRate: number;
  }>;
  dailyTrend: Array<{
    date: string;
    views: number;
    likes: number;
    replies: number;
  }>;
  mediaTypeBreakdown: Array<{
    type: string;
    count: number;
    avgEngagement: number;
  }>;
}

export interface GeneratedReport {
  title: string;
  summary: string;
  highlights: string[];
  recommendations: string[];
  htmlContent: string;
}

function buildReportSystemPrompt(): string {
  return `あなたはソーシャルメディア分析の専門家です。Threads（Meta社のSNS）のアカウントパフォーマンスレポートを生成してください。

## ルール
- 日本語で回答してください。
- データに基づいた具体的で実行可能なアドバイスを提供してください。
- 数値は見やすくフォーマットしてください（カンマ区切りなど）。
- 前期比の増減は必ず言及してください。

## 出力形式
必ず以下のJSON形式のみで出力してください。JSON以外のテキストは含めないでください。
\`\`\`json
{
  "title": "レポートタイトル（例: 週次レポート: 2026年3月20日〜3月26日）",
  "summary": "エグゼクティブサマリー（2-3文で全体像を要約）",
  "highlights": ["ハイライト1", "ハイライト2", "ハイライト3"],
  "recommendations": ["推奨アクション1", "推奨アクション2", "推奨アクション3"]
}
\`\`\`

- title: レポート種別と期間を含むタイトル
- summary: 2-3文の要約。主要な成果と傾向を含む
- highlights: 3-5項目。データから読み取れる重要なポイント
- recommendations: 3-5項目。次の期間に向けた具体的なアクション`;
}

function buildReportUserPrompt(data: ReportData): string {
  const typeLabel = data.type === "weekly" ? "週次" : "月次";

  function pctChange(current: number, previous: number): string {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - previous) / previous) * 100;
    return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
  }

  const topPostsStr = data.topPosts
    .slice(0, 5)
    .map(
      (p, i) =>
        `  ${i + 1}. views:${p.views}, likes:${p.likes}, replies:${p.replies}, engagement:${p.engagementRate.toFixed(1)}%\n     "${p.content.slice(0, 80)}${p.content.length > 80 ? "..." : ""}"`
    )
    .join("\n");

  const mediaStr = data.mediaTypeBreakdown
    .map(
      (m) =>
        `  ${m.type}: ${m.count}件 (平均エンゲージメント: ${m.avgEngagement.toFixed(1)}%)`
    )
    .join("\n");

  return `以下のデータに基づいて、@${data.accountUsername} の${typeLabel}レポートを生成してください。

## 期間
${data.periodStart} 〜 ${data.periodEnd}

## 今期の主要指標
- 閲覧数: ${data.metrics.totalViews.toLocaleString()} (前期比: ${pctChange(data.metrics.totalViews, data.previousMetrics.totalViews)})
- いいね数: ${data.metrics.totalLikes.toLocaleString()} (前期比: ${pctChange(data.metrics.totalLikes, data.previousMetrics.totalLikes)})
- リプライ数: ${data.metrics.totalReplies.toLocaleString()} (前期比: ${pctChange(data.metrics.totalReplies, data.previousMetrics.totalReplies)})
- リポスト数: ${data.metrics.totalReposts.toLocaleString()} (前期比: ${pctChange(data.metrics.totalReposts, data.previousMetrics.totalReposts)})
- 引用数: ${data.metrics.totalQuotes.toLocaleString()} (前期比: ${pctChange(data.metrics.totalQuotes, data.previousMetrics.totalQuotes)})
- 投稿数: ${data.metrics.postsPublished}件 (前期: ${data.previousMetrics.postsPublished}件)
- フォロワー数: ${data.metrics.followersEnd.toLocaleString()} (増減: ${data.metrics.followerChange >= 0 ? "+" : ""}${data.metrics.followerChange})
- 平均エンゲージメント率: ${data.metrics.avgEngagementRate.toFixed(2)}% (前期: ${data.previousMetrics.avgEngagementRate.toFixed(2)}%)

## トップ投稿
${topPostsStr || "  データなし"}

## メディアタイプ別
${mediaStr || "  データなし"}

JSON形式のみで回答してください。`;
}

function parseReportResponse(response: Anthropic.Message): {
  title: string;
  summary: string;
  highlights: string[];
  recommendations: string[];
} {
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AIからの応答が空です");
  }

  let rawText = textBlock.text.trim();
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    rawText = jsonMatch[1].trim();
  }

  let parsed: {
    title: string;
    summary: string;
    highlights: string[];
    recommendations: string[];
  };

  try {
    parsed = JSON.parse(rawText);
  } catch {
    const objectMatch = rawText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        parsed = JSON.parse(objectMatch[0]);
      } catch {
        throw new Error("AIの応答をJSONとして解析できませんでした");
      }
    } else {
      throw new Error("AIの応答にJSONが見つかりませんでした");
    }
  }

  if (!parsed.title || !parsed.summary) {
    throw new Error("AIの応答に必要なフィールドが含まれていません");
  }

  return {
    title: parsed.title,
    summary: parsed.summary,
    highlights: parsed.highlights || [],
    recommendations: parsed.recommendations || [],
  };
}

function formatNumber(n: number): string {
  return n.toLocaleString("ja-JP");
}

function pctChangeValue(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function changeArrow(current: number, previous: number): string {
  const change = pctChangeValue(current, previous);
  if (change > 0) return `<span style="color:#16a34a;">+${change}%</span>`;
  if (change < 0) return `<span style="color:#dc2626;">${change}%</span>`;
  return `<span style="color:#6b7280;">0%</span>`;
}

function buildHtmlReport(
  data: ReportData,
  aiResult: {
    title: string;
    summary: string;
    highlights: string[];
    recommendations: string[];
  }
): string {
  const typeLabel = data.type === "weekly" ? "週次" : "月次";
  const m = data.metrics;
  const pm = data.previousMetrics;

  const topPostsHtml = data.topPosts
    .slice(0, 5)
    .map(
      (p, i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;">${i + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.content.slice(0, 60))}${p.content.length > 60 ? "..." : ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatNumber(p.views)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatNumber(p.likes)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatNumber(p.replies)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${p.engagementRate.toFixed(1)}%</td>
      </tr>`
    )
    .join("");

  // Build daily trend chart as simple bar visualization
  const maxViews = Math.max(...data.dailyTrend.map((d) => d.views), 1);
  const dailyBarsHtml = data.dailyTrend
    .map((d) => {
      const barWidth = Math.max((d.views / maxViews) * 100, 2);
      return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="min-width:80px;font-size:12px;color:#6b7280;">${d.date}</span>
        <div style="flex:1;background:#f3f4f6;border-radius:4px;height:20px;overflow:hidden;">
          <div style="width:${barWidth}%;background:linear-gradient(90deg,#6366f1,#8b5cf6);height:100%;border-radius:4px;"></div>
        </div>
        <span style="min-width:60px;font-size:12px;color:#374151;text-align:right;">${formatNumber(d.views)}</span>
      </div>`;
    })
    .join("");

  const mediaBreakdownHtml = data.mediaTypeBreakdown
    .map(
      (mb) => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;">
        <span style="font-weight:500;">${escapeHtml(mb.type)}</span>
        <span>${mb.count}件 / 平均 ${mb.avgEngagement.toFixed(1)}%</span>
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(aiResult.title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif; color: #1f2937; background: #ffffff; line-height: 1.6; }
  .container { max-width: 800px; margin: 0 auto; padding: 40px 24px; }
  .header { text-align: center; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #e5e7eb; }
  .header h1 { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 8px; }
  .header .period { font-size: 14px; color: #6b7280; }
  .header .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-top: 8px; }
  .badge-weekly { background: #dbeafe; color: #1d4ed8; }
  .badge-monthly { background: #fce7f3; color: #be185d; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
  .summary-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
  .summary-box p { font-size: 14px; color: #0c4a6e; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .kpi-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
  .kpi-card .label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
  .kpi-card .value { font-size: 24px; font-weight: 700; color: #111827; }
  .kpi-card .change { font-size: 12px; margin-top: 4px; }
  .highlight-list, .rec-list { list-style: none; padding: 0; }
  .highlight-list li, .rec-list li { padding: 10px 12px; margin-bottom: 8px; border-radius: 8px; font-size: 14px; display: flex; align-items: flex-start; gap: 8px; }
  .highlight-list li { background: #f0fdf4; border: 1px solid #bbf7d0; }
  .highlight-list li::before { content: "\\2713"; color: #16a34a; font-weight: bold; flex-shrink: 0; }
  .rec-list li { background: #fffbeb; border: 1px solid #fde68a; }
  .rec-list li::before { content: "\\2794"; color: #d97706; flex-shrink: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { padding: 10px 12px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; }
  th:nth-child(n+3) { text-align: right; }
  .footer { text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb; margin-top: 40px; font-size: 12px; color: #9ca3af; }
  @media print {
    .container { padding: 20px; }
    .kpi-grid { grid-template-columns: repeat(4, 1fr); }
  }
  @media (max-width: 600px) {
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    table { font-size: 11px; }
    th, td { padding: 6px 8px !important; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${escapeHtml(aiResult.title)}</h1>
    <div class="period">@${escapeHtml(data.accountUsername)} | ${data.periodStart} 〜 ${data.periodEnd}</div>
    <span class="badge ${data.type === "weekly" ? "badge-weekly" : "badge-monthly"}">${typeLabel}レポート</span>
  </div>

  <div class="section">
    <div class="summary-box">
      <p>${escapeHtml(aiResult.summary)}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">主要指標</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="label">閲覧数</div>
        <div class="value">${formatNumber(m.totalViews)}</div>
        <div class="change">${changeArrow(m.totalViews, pm.totalViews)}</div>
      </div>
      <div class="kpi-card">
        <div class="label">いいね</div>
        <div class="value">${formatNumber(m.totalLikes)}</div>
        <div class="change">${changeArrow(m.totalLikes, pm.totalLikes)}</div>
      </div>
      <div class="kpi-card">
        <div class="label">リプライ</div>
        <div class="value">${formatNumber(m.totalReplies)}</div>
        <div class="change">${changeArrow(m.totalReplies, pm.totalReplies)}</div>
      </div>
      <div class="kpi-card">
        <div class="label">リポスト</div>
        <div class="value">${formatNumber(m.totalReposts)}</div>
        <div class="change">${changeArrow(m.totalReposts, pm.totalReposts)}</div>
      </div>
      <div class="kpi-card">
        <div class="label">投稿数</div>
        <div class="value">${m.postsPublished}</div>
        <div class="change">前期: ${pm.postsPublished}件</div>
      </div>
      <div class="kpi-card">
        <div class="label">フォロワー</div>
        <div class="value">${formatNumber(m.followersEnd)}</div>
        <div class="change"><span style="color:${m.followerChange >= 0 ? "#16a34a" : "#dc2626"};">${m.followerChange >= 0 ? "+" : ""}${formatNumber(m.followerChange)}</span></div>
      </div>
      <div class="kpi-card">
        <div class="label">エンゲージメント率</div>
        <div class="value">${m.avgEngagementRate.toFixed(2)}%</div>
        <div class="change">前期: ${pm.avgEngagementRate.toFixed(2)}%</div>
      </div>
      <div class="kpi-card">
        <div class="label">クリック数</div>
        <div class="value">${formatNumber(m.totalClicks)}</div>
        <div class="change">${changeArrow(m.totalClicks, pm.totalClicks)}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">ハイライト</div>
    <ul class="highlight-list">
      ${aiResult.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("\n      ")}
    </ul>
  </div>

  <div class="section">
    <div class="section-title">推奨アクション</div>
    <ul class="rec-list">
      ${aiResult.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join("\n      ")}
    </ul>
  </div>

  ${
    data.topPosts.length > 0
      ? `
  <div class="section">
    <div class="section-title">トップ投稿</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:center;">#</th>
          <th>内容</th>
          <th style="text-align:right;">閲覧</th>
          <th style="text-align:right;">いいね</th>
          <th style="text-align:right;">リプライ</th>
          <th style="text-align:right;">率</th>
        </tr>
      </thead>
      <tbody>${topPostsHtml}</tbody>
    </table>
  </div>`
      : ""
  }

  ${
    data.dailyTrend.length > 0
      ? `
  <div class="section">
    <div class="section-title">日別閲覧数推移</div>
    ${dailyBarsHtml}
  </div>`
      : ""
  }

  ${
    data.mediaTypeBreakdown.length > 0
      ? `
  <div class="section">
    <div class="section-title">メディアタイプ別パフォーマンス</div>
    ${mediaBreakdownHtml}
  </div>`
      : ""
  }

  <div class="footer">
    <p>Threads Automation - ${typeLabel}パフォーマンスレポート</p>
    <p>生成日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>
  </div>
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function generateReport(
  apiKey: string,
  data: ReportData
): Promise<GeneratedReport> {
  const client = new Anthropic({ apiKey });

  const systemPrompt = buildReportSystemPrompt();
  const userPrompt = buildReportUserPrompt(data);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const aiResult = parseReportResponse(response);

  const htmlContent = buildHtmlReport(data, aiResult);

  return {
    title: aiResult.title,
    summary: aiResult.summary,
    highlights: aiResult.highlights,
    recommendations: aiResult.recommendations,
    htmlContent,
  };
}
