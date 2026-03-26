"use client";

import { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Printer,
  Trash2,
  Loader2,
  AlertCircle,
  Calendar,
  FileBarChart,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ReportViewer } from "@/components/reports/report-viewer";

interface ReportDetail {
  id: string;
  accountId: string;
  type: "weekly" | "monthly";
  title: string;
  periodStart: string;
  periodEnd: string;
  content: string;
  summary: string;
  metrics: Record<string, number>;
  status: "generating" | "completed" | "failed";
  createdAt: string;
}

export default function ReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/reports/${reportId}`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "レポートの取得に失敗しました");
      }
      const data = (await res.json()) as { report: ReportDetail };
      setReport(data.report);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "レポートの取得に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleDelete = async () => {
    if (!confirm("このレポートを削除しますか？")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("削除に失敗しました");
      router.push("/reports");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "削除に失敗しました"
      );
      setDeleting(false);
    }
  };

  const handleDownload = () => {
    if (!report?.content) return;
    const sanitizedContent = DOMPurify.sanitize(report.content);
    const blob = new Blob([sanitizedContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/[/\\?%*:|"<>]/g, "_")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!report?.content) return;
    const sanitizedContent = DOMPurify.sanitize(report.content);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(sanitizedContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          レポートを読み込み中...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/reports")}
          className="w-fit"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          レポート一覧
        </Button>
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const typeLabel = report.type === "weekly" ? "週次" : "月次";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          onClick={() => router.push("/reports")}
          className="w-fit"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          レポート一覧
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <FileBarChart className="h-5 w-5 text-primary" />
              <Badge variant={report.type === "weekly" ? "default" : "secondary"}>
                {typeLabel}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold">{report.title}</h1>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {report.periodStart} 〜 {report.periodEnd}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              HTML ダウンロード
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              印刷
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-destructive hover:text-destructive"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              削除
            </Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      {report.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">サマリー</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{report.summary}</p>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Report content */}
      {report.content ? (
        <ReportViewer htmlContent={report.content} />
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            {report.status === "generating" ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  レポートを生成中です...
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <p className="text-sm text-destructive">
                  レポートの生成に失敗しました
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
