"use client";

import { useState } from "react";
import {
  Clock,
  ChevronDown,
  ChevronUp,
  CalendarPlus,
  Pencil,
  SkipForward,
  Tag,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface CalendarSuggestionCardProps {
  suggestion: {
    date: string;
    time: string;
    topic: string;
    content: string;
    topicTag?: string;
    reasoning: string;
  };
  onSchedule: (content: string, topicTag?: string) => void;
  onEditAndSchedule: (content: string, topicTag?: string) => void;
  onSkip: () => void;
  isSkipped?: boolean;
}

export function CalendarSuggestionCard({
  suggestion,
  onSchedule,
  onEditAndSchedule,
  onSkip,
  isSkipped = false,
}: CalendarSuggestionCardProps) {
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(suggestion.content);

  const handleSchedule = () => {
    onSchedule(editedContent, suggestion.topicTag);
  };

  const handleEditAndSchedule = () => {
    if (isEditing) {
      onEditAndSchedule(editedContent, suggestion.topicTag);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  return (
    <Card
      className={cn(
        "transition-opacity",
        isSkipped && "opacity-40"
      )}
    >
      <CardContent className="p-4">
        {/* Time and Topic */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm font-medium text-primary">
              <Clock className="h-3.5 w-3.5" />
              {suggestion.time}
            </div>
            <span className="text-sm text-muted-foreground">-</span>
            <span className="text-sm font-medium">{suggestion.topic}</span>
          </div>
          {suggestion.topicTag && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              <Tag className="h-3 w-3 mr-1" />
              {suggestion.topicTag}
            </Badge>
          )}
        </div>

        {/* Content */}
        {isEditing ? (
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[100px] mb-3 text-sm"
            maxLength={500}
          />
        ) : (
          <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-3 leading-relaxed">
            {editedContent}
          </p>
        )}

        {/* Character count when editing */}
        {isEditing && (
          <div className="text-xs text-muted-foreground mb-3 text-right">
            {editedContent.length}/500
          </div>
        )}

        {/* Reasoning (collapsible) */}
        <button
          onClick={() => setIsReasoningOpen(!isReasoningOpen)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          {isReasoningOpen ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          AIの提案理由
        </button>
        {isReasoningOpen && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 mb-3">
            {suggestion.reasoning}
          </div>
        )}

        {/* Actions */}
        {!isSkipped && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={handleSchedule}
              className="h-7 text-xs"
            >
              <CalendarPlus className="h-3 w-3 mr-1" />
              予約する
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleEditAndSchedule}
              className="h-7 text-xs"
            >
              <Pencil className="h-3 w-3 mr-1" />
              {isEditing ? "編集して予約" : "編集"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onSkip}
              className="h-7 text-xs text-muted-foreground"
            >
              <SkipForward className="h-3 w-3 mr-1" />
              スキップ
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
