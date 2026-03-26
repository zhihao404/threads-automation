"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TemplateCard } from "@/components/templates/template-card";
import { TemplateEditor } from "@/components/templates/template-editor";
import {
  Plus,
  Search,
  FileText,
  Loader2,
} from "lucide-react";

type MediaType = "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";

interface TemplateData {
  id: string;
  name: string;
  content: string;
  category: string | null;
  mediaType: string;
  createdAt: string;
  updatedAt: string;
}

interface FetchResult {
  templates: TemplateData[];
  total: number;
  categories: string[];
}

function TemplateSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="animate-pulse space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-6 w-6 bg-muted rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-muted rounded" />
            <div className="h-5 w-16 bg-muted rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
          </div>
          <div className="pt-2 border-t">
            <div className="h-3 w-28 bg-muted rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">テンプレートがありません</h3>
      <p className="text-sm text-muted-foreground mb-6">
        テンプレートを作成して、投稿作成を効率化しましょう。
      </p>
      <Button onClick={onCreateClick}>
        <Plus className="h-4 w-4 mr-2" />
        テンプレートを作成
      </Button>
    </div>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("__all__");

  // Editor dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingTemplate, setEditingTemplate] = useState<TemplateData | null>(null);

  // Search debounce
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedCategory && selectedCategory !== "__all__") params.set("category", selectedCategory);
      params.set("limit", "100");

      const response = await fetch(`/api/templates?${params.toString()}`);
      if (!response.ok) {
        throw new Error("テンプレートの取得に失敗しました");
      }
      const data = (await response.json()) as FetchResult;
      setTemplates(data.templates || []);
      setTotal(data.total || 0);
      setCategories(data.categories || []);
    } catch {
      setError("テンプレートの読み込みに失敗しました。再度お試しください。");
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, selectedCategory]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreate = useCallback(() => {
    setEditorMode("create");
    setEditingTemplate(null);
    setEditorOpen(true);
  }, []);

  const handleEdit = useCallback(
    (id: string) => {
      const template = templates.find((t) => t.id === id);
      if (template) {
        setEditorMode("edit");
        setEditingTemplate(template);
        setEditorOpen(true);
      }
    },
    [templates]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("このテンプレートを削除しますか？この操作は取り消せません。")) {
        return;
      }

      try {
        const response = await fetch(`/api/templates/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("削除に失敗しました");
        }

        setTemplates((prev) => prev.filter((t) => t.id !== id));
        setTotal((prev) => Math.max(0, prev - 1));
      } catch {
        alert("テンプレートの削除に失敗しました。もう一度お試しください。");
      }
    },
    []
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      const template = templates.find((t) => t.id === id);
      if (!template) return;

      try {
        const response = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${template.name} (コピー)`,
            content: template.content,
            category: template.category || undefined,
            mediaType: template.mediaType,
          }),
        });

        if (!response.ok) {
          throw new Error("複製に失敗しました");
        }

        // Refresh list
        fetchTemplates();
      } catch {
        alert("テンプレートの複製に失敗しました。もう一度お試しください。");
      }
    },
    [templates, fetchTemplates]
  );

  const handleUse = useCallback(
    (id: string) => {
      const template = templates.find((t) => t.id === id);
      if (template) {
        // Navigate to new post page with template content as query param
        const params = new URLSearchParams();
        params.set("templateId", id);
        router.push(`/posts/new?${params.toString()}`);
      }
    },
    [templates, router]
  );

  const handleSave = useCallback(
    async (data: {
      name: string;
      content: string;
      category?: string;
      mediaType: MediaType;
    }) => {
      if (editorMode === "create") {
        const response = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error((errorData as { error?: string }).error || "作成に失敗しました");
        }
      } else if (editingTemplate) {
        const response = await fetch(`/api/templates/${editingTemplate.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error((errorData as { error?: string }).error || "更新に失敗しました");
        }
      }

      // Refresh list
      fetchTemplates();
    },
    [editorMode, editingTemplate, fetchTemplates]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">テンプレート管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isLoading ? "読み込み中..." : `${total} 件のテンプレート`}
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新しいテンプレート
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="テンプレートを検索..."
            className="pl-9"
          />
        </div>
        <Select
          value={selectedCategory}
          onValueChange={setSelectedCategory}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="カテゴリ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">すべてのカテゴリ</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <TemplateSkeleton key={i} />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState onCreateClick={handleCreate} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onUse={handleUse}
            />
          ))}
        </div>
      )}

      {/* Editor Dialog */}
      <TemplateEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        mode={editorMode}
        template={editingTemplate}
        categories={categories}
        onSave={handleSave}
      />

      {/* Floating Create Button (mobile) */}
      <div className="fixed bottom-6 right-6 lg:hidden">
        <Button
          size="lg"
          className="rounded-full h-14 w-14 shadow-lg"
          onClick={handleCreate}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
