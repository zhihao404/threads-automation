"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Upload, X, Image, Video, Loader2, FileWarning } from "lucide-react";
import {
  type UploadResult,
  formatFileSize,
  getAcceptString,
  validateFile,
} from "@/lib/media";

// =============================================================================
// Media Upload Component
// Supports drag & drop, click to browse, multiple files, and preview
// =============================================================================

interface FileUploadState {
  file: File;
  id: string; // Unique ID for tracking
  status: "pending" | "uploading" | "done" | "error";
  progress: number; // 0-100 (simplified: 0 or 100 since fetch doesn't support progress)
  result?: UploadResult;
  error?: string;
  previewUrl?: string;
}

interface MediaUploadProps {
  mediaType: "image" | "video";
  multiple?: boolean;
  maxFiles?: number;
  onUpload: (results: UploadResult[]) => void;
  onRemove?: (key: string) => void;
  uploadedFiles?: UploadResult[];
  className?: string;
}

let fileIdCounter = 0;
function generateFileId(): string {
  fileIdCounter += 1;
  return `file-${Date.now()}-${fileIdCounter}`;
}

export function MediaUpload({
  mediaType,
  multiple = false,
  maxFiles = 20,
  onUpload,
  onRemove,
  uploadedFiles = [],
  className,
}: MediaUploadProps) {
  const [fileStates, setFileStates] = useState<FileUploadState[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // Keep a ref to the latest fileStates so the unmount cleanup always sees current data
  const fileStatesRef = useRef(fileStates);
  fileStatesRef.current = fileStates;

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      fileStatesRef.current.forEach((fs) => {
        if (fs.previewUrl) {
          URL.revokeObjectURL(fs.previewUrl);
        }
      });
    };
  }, []);

  const totalFiles = uploadedFiles.length + fileStates.filter((f) => f.status !== "error").length;

  const uploadFile = useCallback(
    async (fileState: FileUploadState) => {
      const formData = new FormData();
      formData.append("file", fileState.file);
      formData.append("type", mediaType);

      try {
        const response = await fetch("/api/media/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(
            data.error || "アップロードに失敗しました"
          );
        }

        const result = (await response.json()) as UploadResult;
        return result;
      } catch (err) {
        throw err instanceof Error
          ? err
          : new Error("アップロードに失敗しました");
      }
    },
    [mediaType]
  );

  const processFiles = useCallback(
    async (files: File[]) => {
      // Check total file count limit
      const remainingSlots = maxFiles - uploadedFiles.length;
      if (remainingSlots <= 0) {
        return;
      }

      const filesToProcess = multiple
        ? files.slice(0, remainingSlots)
        : files.slice(0, 1);

      // Validate all files first
      const validatedFiles: FileUploadState[] = [];

      for (const file of filesToProcess) {
        const validation = validateFile(file, mediaType);
        const id = generateFileId();

        const previewUrl =
          mediaType === "image" ? URL.createObjectURL(file) : undefined;

        if (!validation.valid) {
          validatedFiles.push({
            file,
            id,
            status: "error",
            progress: 0,
            error: validation.error,
            previewUrl,
          });
        } else {
          validatedFiles.push({
            file,
            id,
            status: "pending",
            progress: 0,
            previewUrl,
          });
        }
      }

      // If not multiple, clear previous files
      if (!multiple) {
        setFileStates((prev) => {
          prev.forEach((fs) => {
            if (fs.previewUrl) URL.revokeObjectURL(fs.previewUrl);
          });
          return validatedFiles;
        });
      } else {
        setFileStates((prev) => [...prev, ...validatedFiles]);
      }

      // Upload valid files
      const validFiles = validatedFiles.filter((f) => f.status === "pending");
      const uploadResults: UploadResult[] = [];

      for (const fileState of validFiles) {
        // Mark as uploading
        setFileStates((prev) =>
          prev.map((fs) =>
            fs.id === fileState.id ? { ...fs, status: "uploading" as const } : fs
          )
        );

        try {
          const result = await uploadFile(fileState);
          uploadResults.push(result);

          setFileStates((prev) =>
            prev.map((fs) =>
              fs.id === fileState.id
                ? { ...fs, status: "done" as const, progress: 100, result }
                : fs
            )
          );
        } catch (err) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : "アップロードに失敗しました";

          setFileStates((prev) =>
            prev.map((fs) =>
              fs.id === fileState.id
                ? { ...fs, status: "error" as const, error: errorMessage }
                : fs
            )
          );
        }
      }

      // Notify parent of all successful uploads
      if (uploadResults.length > 0) {
        onUpload(uploadResults);
      }
    },
    [mediaType, multiple, maxFiles, uploadedFiles.length, uploadFile, onUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      processFiles(Array.from(files));

      // Reset input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [processFiles]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;
      processFiles(Array.from(files));
    },
    [processFiles]
  );

  const handleRemoveFileState = useCallback(
    (id: string) => {
      setFileStates((prev) => {
        const fileState = prev.find((fs) => fs.id === id);
        if (fileState?.previewUrl) {
          URL.revokeObjectURL(fileState.previewUrl);
        }
        // If the file was successfully uploaded, also call onRemove
        if (fileState?.result?.key && onRemove) {
          onRemove(fileState.result.key);
        }
        return prev.filter((fs) => fs.id !== id);
      });
    },
    [onRemove]
  );

  const handleRemoveUploaded = useCallback(
    (key: string) => {
      if (onRemove) {
        onRemove(key);
      }
    },
    [onRemove]
  );

  const handleClickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const MediaIcon = mediaType === "image" ? Image : Video;
  const acceptString = getAcceptString(mediaType);
  const canAddMore = totalFiles < maxFiles;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop zone */}
      {canAddMore && (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClickUpload}
          className={cn(
            "relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptString}
            multiple={multiple}
            onChange={handleFileSelect}
            className="sr-only"
          />

          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
              isDragOver ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            <Upload className="h-6 w-6" />
          </div>

          <div className="text-center">
            <p className="text-sm font-medium">
              {isDragOver
                ? "ファイルをドロップ"
                : "ここにファイルをドラッグ＆ドロップ"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              またはクリックしてファイルを選択
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MediaIcon className="h-3.5 w-3.5" />
            <span>
              {mediaType === "image"
                ? "JPEG, PNG (最大 8MB)"
                : "MP4, QuickTime (最大 1GB)"}
            </span>
          </div>

          {multiple && (
            <p className="text-xs text-muted-foreground">
              最大 {maxFiles} ファイル
              {uploadedFiles.length > 0 && (
                <span>
                  {" "}
                  (あと {maxFiles - uploadedFiles.length} ファイル追加可能)
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Already uploaded files (from parent) */}
      {uploadedFiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {uploadedFiles.map((file) => (
            <div
              key={file.key}
              className="group relative rounded-lg border bg-card overflow-hidden"
            >
              {file.contentType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.url}
                  alt="アップロード済み"
                  className="aspect-square object-cover w-full"
                />
              ) : (
                <div className="aspect-square flex flex-col items-center justify-center bg-muted">
                  <Video className="h-8 w-8 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-1">
                    動画
                  </span>
                </div>
              )}

              <div className="p-2">
                <p className="text-xs text-muted-foreground truncate">
                  {formatFileSize(file.size)}
                </p>
              </div>

              {/* Remove button */}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveUploaded(file.key);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Files being processed */}
      {fileStates.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {fileStates.map((fileState) => (
            <div
              key={fileState.id}
              className="group relative rounded-lg border bg-card overflow-hidden"
            >
              {/* Preview */}
              {fileState.previewUrl && mediaType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fileState.previewUrl}
                  alt={fileState.file.name}
                  className={cn(
                    "aspect-square object-cover w-full",
                    fileState.status === "uploading" && "opacity-50",
                    fileState.status === "error" && "opacity-30"
                  )}
                />
              ) : (
                <div
                  className={cn(
                    "aspect-square flex flex-col items-center justify-center bg-muted",
                    fileState.status === "error" && "bg-red-50"
                  )}
                >
                  {fileState.status === "error" ? (
                    <FileWarning className="h-8 w-8 text-red-400" />
                  ) : (
                    <Video className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              )}

              {/* Upload overlay */}
              {fileState.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              {/* File info */}
              <div className="p-2 space-y-1">
                <p className="text-xs truncate" title={fileState.file.name}>
                  {fileState.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(fileState.file.size)}
                </p>

                {/* Status */}
                {fileState.status === "uploading" && (
                  <p className="text-xs text-primary">アップロード中...</p>
                )}
                {fileState.status === "done" && (
                  <p className="text-xs text-green-600">完了</p>
                )}
                {fileState.status === "error" && (
                  <p className="text-xs text-red-500 line-clamp-2">
                    {fileState.error}
                  </p>
                )}
              </div>

              {/* Remove button */}
              {(fileState.status === "done" || fileState.status === "error") && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFileState(fileState.id);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* File count info */}
      {(uploadedFiles.length > 0 || fileStates.filter((f) => f.status === "done").length > 0) && (
        <p className="text-xs text-muted-foreground">
          {uploadedFiles.length + fileStates.filter((f) => f.status === "done").length} /{" "}
          {multiple ? maxFiles : 1} ファイル
        </p>
      )}
    </div>
  );
}
