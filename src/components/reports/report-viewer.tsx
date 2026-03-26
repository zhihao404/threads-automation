"use client";

interface ReportViewerProps {
  htmlContent: string;
}

export function ReportViewer({ htmlContent }: ReportViewerProps) {
  return (
    <div className="w-full rounded-lg border bg-white">
      <div
        className="report-content"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
}
