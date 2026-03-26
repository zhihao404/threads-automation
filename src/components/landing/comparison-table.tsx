import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureRow {
  name: string;
  free: string;
  pro: string;
  business: string;
}

const features: FeatureRow[] = [
  {
    name: "Threadsアカウント数",
    free: "1",
    pro: "3",
    business: "10",
  },
  {
    name: "月間投稿数",
    free: "30",
    pro: "無制限",
    business: "無制限",
  },
  {
    name: "スケジュール投稿",
    free: "5件",
    pro: "無制限",
    business: "無制限",
  },
  {
    name: "AI生成回数/月",
    free: "10回",
    pro: "100回",
    business: "無制限",
  },
  {
    name: "テンプレート数",
    free: "5個",
    pro: "50個",
    business: "無制限",
  },
  {
    name: "分析機能",
    free: "基本",
    pro: "フル",
    business: "フル",
  },
  {
    name: "レポート生成",
    free: "-",
    pro: "週次",
    business: "週次+月次",
  },
  {
    name: "リプライ管理",
    free: "閲覧のみ",
    pro: "フル管理",
    business: "フル管理",
  },
  {
    name: "優先サポート",
    free: "-",
    pro: "-",
    business: "check",
  },
];

function CellContent({ value }: { value: string }) {
  if (value === "check") {
    return (
      <Check className="mx-auto h-4 w-4 text-green-600" aria-label="あり" />
    );
  }
  if (value === "-") {
    return (
      <Minus
        className="mx-auto h-4 w-4 text-muted-foreground/40"
        aria-label="なし"
      />
    );
  }
  return <span>{value}</span>;
}

function MobileCard({ feature }: { feature: FeatureRow }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h4 className="mb-3 text-sm font-semibold">{feature.name}</h4>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-muted/50 px-2 py-2">
          <div className="mb-1 font-medium text-muted-foreground">Free</div>
          <div className="font-semibold">
            <CellContent value={feature.free} />
          </div>
        </div>
        <div className="rounded-lg bg-purple-50 px-2 py-2 ring-1 ring-purple-200">
          <div className="mb-1 font-medium text-purple-600">Pro</div>
          <div className="font-semibold">
            <CellContent value={feature.pro} />
          </div>
        </div>
        <div className="rounded-lg bg-muted/50 px-2 py-2">
          <div className="mb-1 font-medium text-muted-foreground">
            Business
          </div>
          <div className="font-semibold">
            <CellContent value={feature.business} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComparisonTable() {
  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-6 py-4 text-left font-semibold">機能</th>
                <th className="px-6 py-4 text-center font-semibold">Free</th>
                <th className="px-6 py-4 text-center font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    Pro
                    <span className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-2 py-0.5 text-[10px] font-medium text-white">
                      おすすめ
                    </span>
                  </span>
                </th>
                <th className="px-6 py-4 text-center font-semibold">
                  Business
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr
                  key={feature.name}
                  className={cn(
                    "border-b last:border-b-0 transition-colors hover:bg-muted/20",
                    index % 2 === 0 ? "bg-transparent" : "bg-muted/10"
                  )}
                >
                  <td className="px-6 py-4 font-medium">{feature.name}</td>
                  <td className="px-6 py-4 text-center text-muted-foreground">
                    <CellContent value={feature.free} />
                  </td>
                  <td className="px-6 py-4 text-center font-medium">
                    <CellContent value={feature.pro} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <CellContent value={feature.business} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {features.map((feature) => (
          <MobileCard key={feature.name} feature={feature} />
        ))}
      </div>
    </>
  );
}
