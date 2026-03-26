"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Braces, Plus, Calendar, Clock, Hash } from "lucide-react";
import { BUILTIN_VARIABLES } from "@/lib/templates/render";

const BUILTIN_VARIABLE_INFO: {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  { key: "date", label: "日付", icon: Calendar, description: "現在の日付" },
  { key: "time", label: "時刻", icon: Clock, description: "現在の時刻" },
  { key: "weekday", label: "曜日", icon: Calendar, description: "現在の曜日" },
  { key: "year", label: "年", icon: Hash, description: "現在の年" },
  { key: "month", label: "月", icon: Hash, description: "現在の月" },
  { key: "day", label: "日", icon: Hash, description: "現在の日" },
];

interface VariableInserterProps {
  onInsert: (variable: string) => void;
}

export function VariableInserter({ onInsert }: VariableInserterProps) {
  const [customVariable, setCustomVariable] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  const handleInsertBuiltin = (key: string) => {
    onInsert(`{{${key}}}`);
  };

  const handleInsertCustom = () => {
    const trimmed = customVariable.trim();
    if (trimmed && /^\w+$/.test(trimmed)) {
      onInsert(`{{${trimmed}}}`);
      setCustomVariable("");
      setShowCustomInput(false);
    }
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInsertCustom();
    } else if (e.key === "Escape") {
      setShowCustomInput(false);
      setCustomVariable("");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" type="button">
            <Braces className="h-3.5 w-3.5 mr-1.5" />
            変数を挿入
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>組み込み変数</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {BUILTIN_VARIABLE_INFO.map((v) => {
            const Icon = v.icon;
            const preview = BUILTIN_VARIABLES[v.key]();
            return (
              <DropdownMenuItem
                key={v.key}
                onClick={() => handleInsertBuiltin(v.key)}
              >
                <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm">
                    {v.label}{" "}
                    <span className="text-muted-foreground font-mono text-xs">
                      {`{{${v.key}}}`}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {v.description}: {preview}
                  </span>
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              setShowCustomInput(true);
              setTimeout(() => customInputRef.current?.focus(), 100);
            }}
          >
            <Plus className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-sm">カスタム変数を追加</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showCustomInput && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground font-mono">{"{{"}</span>
            <Input
              ref={customInputRef}
              value={customVariable}
              onChange={(e) => setCustomVariable(e.target.value)}
              onKeyDown={handleCustomKeyDown}
              placeholder="変数名"
              className="h-8 w-32 text-sm font-mono"
            />
            <span className="text-sm text-muted-foreground font-mono">{"}}"}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={handleInsertCustom}
            disabled={!customVariable.trim() || !/^\w+$/.test(customVariable.trim())}
          >
            追加
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => {
              setShowCustomInput(false);
              setCustomVariable("");
            }}
          >
            キャンセル
          </Button>
        </div>
      )}
    </div>
  );
}
