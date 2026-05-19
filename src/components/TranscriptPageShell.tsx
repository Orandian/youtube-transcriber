"use client";

import { useState, useCallback, useRef } from "react";
import { VideoPanel } from "./VideoPanel";
import { TranscriptPanel } from "./TranscriptPanel";
import { LayoutToggle, type LayoutMode } from "./LayoutToggle";
import { ThemeToggle } from "./ThemeToggle";
import { useTranscript } from "@/hooks/useTranscript";
import Link from "next/link";

interface TranscriptPageShellProps {
  videoId: string;
}

export function TranscriptPageShell({ videoId }: TranscriptPageShellProps) {
  const [layout, setLayout] = useState<LayoutMode>("left");
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [videoHeightPx, setVideoHeightPx] = useState(270);
  const [videoWidthPx, setVideoWidthPx] = useState(480);
  const seekFnRef = useRef<((seconds: number) => void) | null>(null);

  // Fetch transcript client-side from the user's browser (residential IP).
  // YouTube blocks cloud IPs but allows CORS from the browser.
  const { lines, status } = useTranscript(videoId);

  const handleSeekReady = useCallback((fn: (seconds: number) => void) => {
    seekFnRef.current = fn;
  }, []);
  const handleSeek = useCallback((s: number) => {
    seekFnRef.current?.(s);
  }, []);
  const handleTimeUpdate = useCallback((ms: number) => {
    setCurrentTimeMs(ms);
  }, []);

  function startHeightResize(startY: number) {
    let lastY = startY;
    const onMouseMove = (e: MouseEvent) => move(e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      move(e.touches[0].clientY);
    };
    function move(y: number) {
      const dy = y - lastY;
      lastY = y;
      setVideoHeightPx((h) => Math.min(520, Math.max(120, h + dy)));
    }
    function cleanup() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", cleanup);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", cleanup);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", cleanup);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", cleanup);
  }

  function startWidthResize(startX: number, side: "left" | "right") {
    let lastX = startX;
    const onMouseMove = (e: MouseEvent) => move(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      move(e.touches[0].clientX);
    };
    function move(x: number) {
      const dx = x - lastX;
      lastX = x;
      const delta = side === "right" ? dx : -dx;
      setVideoWidthPx((w) => Math.min(900, Math.max(280, w + delta)));
    }
    function cleanup() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", cleanup);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", cleanup);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", cleanup);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", cleanup);
  }

  const isVertical = layout === "vertical";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-zinc-950">
      <header className="shrink-0 flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 dark:text-zinc-600 font-mono hidden sm:block">
            {videoId}
          </span>
          <LayoutToggle mode={layout} onChange={setLayout} />
          <ThemeToggle />
        </div>
      </header>

      {isVertical && (
        <main className="flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex justify-center">
          <div
            className="relative flex flex-col h-full overflow-hidden shadow-xl"
            style={{ width: videoWidthPx, maxWidth: "100%" }}
          >
            {/* Left width handle */}
            <div
              className="hidden lg:flex absolute top-0 bottom-0 -left-3 w-3 z-20 items-center justify-center cursor-ew-resize group select-none"
              onMouseDown={(e) => {
                e.preventDefault();
                startWidthResize(e.clientX, "left");
              }}
              onTouchStart={(e) =>
                startWidthResize(e.touches[0].clientX, "left")
              }
            >
              <div className="w-0.5 h-12 rounded-full bg-zinc-300 dark:bg-zinc-600 group-hover:bg-zinc-500 dark:group-hover:bg-zinc-400 transition-colors" />
            </div>
            {/* Right width handle */}
            <div
              className="hidden lg:flex absolute top-0 bottom-0 -right-3 w-3 z-20 items-center justify-center cursor-ew-resize group select-none"
              onMouseDown={(e) => {
                e.preventDefault();
                startWidthResize(e.clientX, "right");
              }}
              onTouchStart={(e) =>
                startWidthResize(e.touches[0].clientX, "right")
              }
            >
              <div className="w-0.5 h-12 rounded-full bg-zinc-300 dark:bg-zinc-600 group-hover:bg-zinc-500 dark:group-hover:bg-zinc-400 transition-colors" />
            </div>

            <div
              className="w-full bg-zinc-950 shrink-0"
              style={{ height: videoHeightPx }}
            >
              <VideoPanel
                videoId={videoId}
                onSeekReady={handleSeekReady}
                onTimeUpdate={handleTimeUpdate}
              />
            </div>

            <div
              onMouseDown={(e) => {
                e.preventDefault();
                startHeightResize(e.clientY);
              }}
              onTouchStart={(e) => startHeightResize(e.touches[0].clientY)}
              className="w-full h-3 shrink-0 flex items-center justify-center cursor-row-resize bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 group select-none transition-colors"
            >
              <div className="w-10 h-0.5 rounded-full bg-zinc-400 dark:bg-zinc-600 group-hover:bg-zinc-500 dark:group-hover:bg-zinc-400 transition-colors" />
            </div>

            <div className="w-full flex-1 min-h-0 overflow-hidden bg-white dark:bg-zinc-900">
              <TranscriptPanel
                lines={lines}
                status={status}
                currentTimeMs={currentTimeMs}
                onSeek={handleSeek}
                videoId={videoId}
              />
            </div>
          </div>
        </main>
      )}

      {!isVertical && (
        <main
          className={`flex-1 overflow-hidden flex flex-col ${layout === "right" ? "lg:flex-row-reverse" : "lg:flex-row"}`}
        >
          <div className="w-full lg:w-1/2 bg-zinc-950 shrink-0 flex items-center">
            <div
              className="relative w-full"
              style={{ paddingBottom: "56.25%" }}
            >
              <div className="absolute inset-0">
                <VideoPanel
                  videoId={videoId}
                  onSeekReady={handleSeekReady}
                  onTimeUpdate={handleTimeUpdate}
                />
              </div>
            </div>
          </div>
          <div className="w-full lg:w-1/2 flex-1 overflow-hidden border-t lg:border-t-0 lg:border-l border-zinc-100 dark:border-zinc-800">
            <TranscriptPanel
              lines={lines}
              status={status}
              currentTimeMs={currentTimeMs}
              onSeek={handleSeek}
              videoId={videoId}
            />
          </div>
        </main>
      )}
    </div>
  );
}
