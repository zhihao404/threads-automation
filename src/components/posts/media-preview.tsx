"use client";

import { useState, useCallback } from "react";
import { Play, X, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MediaPreviewProps {
  mediaType: "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";
  mediaUrls: string[];
  className?: string;
  compact?: boolean;
}

function isVideoUrl(url: string): boolean {
  const videoExtensions = [".mp4", ".mov", ".avi", ".webm", ".mkv"];
  const lower = url.toLowerCase();
  return videoExtensions.some((ext) => lower.includes(ext));
}

export function MediaPreview({
  mediaType,
  mediaUrls,
  className,
  compact = false,
}: MediaPreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = useCallback(
    (index: number) => {
      if (compact) return;
      setLightboxIndex(index);
      setLightboxOpen(true);
    },
    [compact]
  );

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const navigateLightbox = useCallback(
    (direction: "prev" | "next") => {
      setLightboxIndex((prev) => {
        if (direction === "prev") {
          return prev > 0 ? prev - 1 : mediaUrls.length - 1;
        }
        return prev < mediaUrls.length - 1 ? prev + 1 : 0;
      });
    },
    [mediaUrls.length]
  );

  if (mediaType === "TEXT" || mediaUrls.length === 0) {
    return null;
  }

  // Single image
  if (mediaType === "IMAGE" && mediaUrls.length === 1) {
    return (
      <>
        <div
          className={cn(
            "relative rounded-lg overflow-hidden bg-muted",
            compact ? "aspect-video max-h-32" : "aspect-video max-h-64",
            !compact && "cursor-pointer",
            className
          )}
          onClick={() => openLightbox(0)}
        >
          <img
            src={mediaUrls[0]}
            alt="投稿画像"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        {!compact && lightboxOpen && (
          <Lightbox
            urls={mediaUrls}
            currentIndex={lightboxIndex}
            onClose={closeLightbox}
            onNavigate={navigateLightbox}
          />
        )}
      </>
    );
  }

  // Single video
  if (mediaType === "VIDEO") {
    return (
      <div
        className={cn(
          "relative rounded-lg overflow-hidden bg-muted",
          compact ? "aspect-video max-h-32" : "aspect-video max-h-64",
          className
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <div className="h-12 w-12 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
            <Play className="h-6 w-6 text-white ml-0.5" fill="white" />
          </div>
        </div>
        {/* Attempt to show video thumbnail if possible */}
        {mediaUrls[0] && !isVideoUrl(mediaUrls[0]) ? (
          <img
            src={mediaUrls[0]}
            alt="動画サムネイル"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted">
            <Play className="h-8 w-8" />
            {!compact && (
              <span className="text-xs">動画</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Carousel
  if (mediaType === "CAROUSEL") {
    const displayCount = compact ? 3 : 4;
    const visibleUrls = mediaUrls.slice(0, displayCount);
    const overflowCount = mediaUrls.length - displayCount;

    return (
      <>
        <div
          className={cn(
            "grid gap-1.5 rounded-lg overflow-hidden",
            compact
              ? "grid-cols-3 max-h-24"
              : visibleUrls.length <= 2
                ? "grid-cols-2"
                : "grid-cols-3",
            className
          )}
        >
          {visibleUrls.map((url, index) => (
            <div
              key={index}
              className={cn(
                "relative bg-muted overflow-hidden rounded-md",
                compact ? "aspect-square" : "aspect-square",
                !compact && "cursor-pointer hover:opacity-90 transition-opacity"
              )}
              onClick={() => openLightbox(index)}
            >
              {isVideoUrl(url) ? (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Play className="h-5 w-5 text-muted-foreground" />
                </div>
              ) : (
                <img
                  src={url}
                  alt={`カルーセル ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}

              {/* Overflow indicator on last visible item */}
              {index === visibleUrls.length - 1 && overflowCount > 0 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    +{overflowCount}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Carousel count */}
        {!compact && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
            <ImageIcon className="h-3 w-3" />
            <span>{mediaUrls.length}枚のメディア</span>
          </div>
        )}

        {!compact && lightboxOpen && (
          <Lightbox
            urls={mediaUrls}
            currentIndex={lightboxIndex}
            onClose={closeLightbox}
            onNavigate={navigateLightbox}
          />
        )}
      </>
    );
  }

  return null;
}

// Lightbox component for full-size viewing
function Lightbox({
  urls,
  currentIndex,
  onClose,
  onNavigate,
}: {
  urls: string[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (direction: "prev" | "next") => void;
}) {
  const currentUrl = urls[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 right-4 z-10 h-9 w-9 p-0 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </Button>

      {/* Counter */}
      {urls.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/40 rounded-full px-3 py-1">
          {currentIndex + 1} / {urls.length}
        </div>
      )}

      {/* Previous button */}
      {urls.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute left-4 z-10 h-10 w-10 p-0 text-white hover:bg-white/20 rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate("prev");
          }}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      )}

      {/* Image */}
      <div
        className="max-w-[90vw] max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideoUrl(currentUrl) ? (
          <div className="flex flex-col items-center gap-3 text-white">
            <Play className="h-16 w-16" />
            <span className="text-sm">動画プレビュー</span>
          </div>
        ) : (
          <img
            src={currentUrl}
            alt={`メディア ${currentIndex + 1}`}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
          />
        )}
      </div>

      {/* Next button */}
      {urls.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-4 z-10 h-10 w-10 p-0 text-white hover:bg-white/20 rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate("next");
          }}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
