"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecurringCard } from "@/components/schedule/recurring-card";
import { ScheduleEditor } from "@/components/schedule/schedule-editor";
import type { RecurringScheduleData } from "@/components/schedule/recurring-card";
import { Plus, Repeat, Loader2, Calendar } from "lucide-react";

interface AccountOption {
  id: string;
  username: string;
  displayName: string | null;
}

interface TemplateOption {
  id: string;
  name: string;
  content: string;
}

export default function RecurringSchedulesPage() {
  const [schedules, setSchedules] = useState<RecurringScheduleData[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("__all__");
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RecurringScheduleData | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch accounts
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("/api/accounts");
        if (res.ok) {
          const data = (await res.json()) as { accounts?: Array<{ id: string; username: string; displayName?: string | null }> };
          const accs: AccountOption[] = (data.accounts || []).map(
            (a: { id: string; username: string; displayName?: string | null }) => ({
              id: a.id,
              username: a.username,
              displayName: a.displayName ?? null,
            }),
          );
          setAccounts(accs);
        }
      } catch (error) {
        console.error("Failed to fetch accounts:", error);
      }
    }
    fetchAccounts();
  }, []);

  // Fetch templates
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch("/api/templates");
        if (res.ok) {
          const data = (await res.json()) as { templates?: Array<{ id: string; name: string; content: string }> };
          const tmpls: TemplateOption[] = (data.templates || []).map(
            (t: { id: string; name: string; content: string }) => ({
              id: t.id,
              name: t.name,
              content: t.content,
            }),
          );
          setTemplates(tmpls);
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      }
    }
    fetchTemplates();
  }, []);

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAccountId && selectedAccountId !== "__all__") {
        params.set("accountId", selectedAccountId);
      }
      const res = await fetch(`/api/schedules?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { schedules?: RecurringScheduleData[] };
        setSchedules(data.schedules || []);
      }
    } catch (error) {
      console.error("Failed to fetch schedules:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Toggle active/inactive
  const handleToggle = useCallback(
    async (id: string, isActive: boolean) => {
      try {
        const res = await fetch(`/api/schedules/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        });
        if (res.ok) {
          setSchedules((prev) =>
            prev.map((s) =>
              s.id === id ? { ...s, isActive } : s,
            ),
          );
        }
      } catch (error) {
        console.error("Failed to toggle schedule:", error);
      }
    },
    [],
  );

  // Edit
  const handleEdit = useCallback((schedule: RecurringScheduleData) => {
    setEditingSchedule(schedule);
    setEditorOpen(true);
  }, []);

  // Delete
  const handleDelete = useCallback(
    async (id: string) => {
      if (deleteConfirmId !== id) {
        setDeleteConfirmId(id);
        // Auto-reset after 3 seconds
        setTimeout(() => setDeleteConfirmId(null), 3000);
        return;
      }

      try {
        const res = await fetch(`/api/schedules/${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setSchedules((prev) => prev.filter((s) => s.id !== id));
          setDeleteConfirmId(null);
        }
      } catch (error) {
        console.error("Failed to delete schedule:", error);
      }
    },
    [deleteConfirmId],
  );

  // Save (create or update)
  const handleSave = useCallback(
    async (data: {
      accountId: string;
      templateId?: string;
      cronExpression: string;
      timezone: string;
    }) => {
      if (editingSchedule) {
        // Update
        const res = await fetch(`/api/schedules/${editingSchedule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cronExpression: data.cronExpression,
            templateId: data.templateId || null,
            timezone: data.timezone,
          }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error || "更新に失敗しました");
        }
      } else {
        // Create
        const res = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: data.accountId,
            templateId: data.templateId,
            cronExpression: data.cronExpression,
            timezone: data.timezone,
          }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error || "作成に失敗しました");
        }
      }

      setEditingSchedule(null);
      await fetchSchedules();
    },
    [editingSchedule, fetchSchedules],
  );

  const handleOpenCreate = useCallback(() => {
    setEditingSchedule(null);
    setEditorOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Repeat className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">定期投稿</h1>
            <p className="text-sm text-muted-foreground">
              {schedules.length > 0
                ? `${schedules.length}件のスケジュール`
                : "スケジュールはまだありません"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {accounts.length > 1 && (
            <Select
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="全アカウント" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全アカウント</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    @{acc.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新規スケジュール
          </Button>
        </div>
      </div>

      {/* Schedule list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-1">定期投稿スケジュールがありません</h3>
          <p className="text-sm text-muted-foreground mb-4">
            テンプレートを使って定期的に自動投稿するスケジュールを作成しましょう。
          </p>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            最初のスケジュールを作成
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {schedules.map((schedule) => (
            <RecurringCard
              key={schedule.id}
              schedule={schedule}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Editor dialog */}
      <ScheduleEditor
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditingSchedule(null);
        }}
        onSave={handleSave}
        editingSchedule={editingSchedule}
        accounts={accounts}
        templates={templates}
        defaultAccountId={
          selectedAccountId !== "__all__" ? selectedAccountId : undefined
        }
      />
    </div>
  );
}
