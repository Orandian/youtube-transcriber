"use client";

import { useState, useCallback, useRef } from "react";
import type { TranscriptLine } from "@/types/transcript";
import { VideoPanel } from "./VideoPanel";
import { TranscriptPanel } from "./TranscriptPanel";
import { LayoutToggle, type LayoutMode } from "./LayoutToggle";
import { ThemeToggle } from "./ThemeToggle";
import Link from "next/link";

const DEFAULT_VIDEO_HEIGHT = 270;
const MIN_VIDEO_HEIGHT = 120;
const MAX_VIDEO_HEIGHT = 520;

const DEFAULT_VIDEO_WIDTH = 480;
const MIN_VIDEO_WIDTH = 280;
const MAX_VIDEO_WIDTH = 900;

interface TranscriptPageShellProps {
  videoId: string;
  lines: TranscriptLine[];
}

export function TranscriptPageShell({
  videoId,
  lines,
}: TranscriptPageShellProps) {
  const [layout, setLayout] = useState<LayoutMode>("left");
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [videoHeightPx, setVideoHeightPx] = useState(DEFAULT_VIDEO_HEIGHT);
  const [videoWidthPx, setVideoWidthPx] = useState(DEFAULT_VIDEO_WIDTH);
  const seekFnRef = useRef<((seconds: number) => void) | null>(null);

  const handleSeekReady = useCallback((fn: (seconds: number) => void) => {
    seekFnRef.current = fn;
  }, []);
  const handleSeek = useCallback((s: number) => {
    seekFnRef.current?.(s);
  }, []);
  const handleTimeUpdate = useCallback((ms: number) => {
    setCurrentTimeMs(ms);
  }, []);

  // ── Vertical drag (height) ─────────────────────────────────────────────────
  function startHeightResize(startY: number) {
    let lastY = startY;

    const onMouseMove = (e: MouseEvent) => move(e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      move(e.touches[0].clientY);
    };

    function move(clientY: number) {
      const dy = clientY - lastY;
      lastY = clientY;
      setVideoHeightPx((h) =>
        Math.min(MAX_VIDEO_HEIGHT, Math.max(MIN_VIDEO_HEIGHT, h + dy)),
      );
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

  // ── Horizontal drag (width) ────────────────────────────────────────────────
  // side: 'left' handle → dragging left makes it wider, 'right' → dragging right makes it wider
  function startWidthResize(startX: number, side: "left" | "right") {
    let lastX = startX;

    const onMouseMove = (e: MouseEvent) => move(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      move(e.touches[0].clientX);
    };

    function move(clientX: number) {
      const dx = clientX - lastX;
      lastX = clientX;
      const delta = side === "right" ? dx : -dx;
      setVideoWidthPx((w) =>
        Math.min(MAX_VIDEO_WIDTH, Math.max(MIN_VIDEO_WIDTH, w + delta)),
      );
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
      {/* Top bar */}
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

      {/* ── Vertical layout ── */}
      {isVertical && (
        <main className="flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex justify-center">
          {/*
            Single column — width controlled by the left/right handles.
            justify-center centres it horizontally; default align-items:stretch
            makes it fill the full height of main without needing explicit h-full tricks.
          */}
          <div
            className="relative flex flex-col h-full overflow-hidden shadow-xl"
            style={{ width: videoWidthPx, maxWidth: "100%" }}
          >
            {/* ── Left width handle (desktop only) ── */}
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

            {/* ── Right width handle (desktop only) ── */}
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

            {/* ── Video section ── */}
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

            {/* ── Height drag handle ── */}
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

            {/* ── Transcript section ── */}
            <div className="w-full flex-1 min-h-0 overflow-hidden bg-white dark:bg-zinc-900">
              <TranscriptPanel
                lines={lines}
                currentTimeMs={currentTimeMs}
                onSeek={handleSeek}
                videoId={videoId}
              />
            </div>
          </div>
        </main>
      )}

      {/* ── Horizontal layouts (left / right) ── */}
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
