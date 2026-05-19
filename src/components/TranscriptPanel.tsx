"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import type { TranscriptLine } from "@/types/transcript";
import { TranscriptLineItem } from "./TranscriptLineItem";
import { buildTxt, buildSrt, buildJson, triggerDownload } from "@/lib/download";

interface TranscriptPanelProps {
  lines: TranscriptLine[];
  currentTimeMs: number;
  onSeek: (seconds: number) => void;
  videoId: string;
}

function DownloadMenu({
  lines,
  videoId,
}: {
  lines: TranscriptLine[];
  videoId: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function download(format: "txt" | "srt" | "json") {
    setOpen(false);
    const name = `transcript-${videoId}`;
    if (format === "txt")
      triggerDownload(buildTxt(lines), `${name}.txt`, "text/plain");
    if (format === "srt")
      triggerDownload(buildSrt(lines), `${name}.srt`, "text/plain");
    if (format === "json")
      triggerDownload(buildJson(lines), `${name}.json`, "application/json");
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Download
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden z-20">
          {[
            {
              fmt: "txt" as const,
              label: "Plain Text",
              ext: ".txt",
              desc: "With timestamps",
            },
            {
              fmt: "srt" as const,
              label: "SRT Subtitle",
              ext: ".srt",
              desc: "For video players",
            },
            {
              fmt: "json" as const,
              label: "JSON",
              ext: ".json",
              desc: "Raw data",
            },
          ].map(({ fmt, label, ext, desc }) => (
            <button
              key={fmt}
              onClick={() => download(fmt)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <div>
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {label}
                </div>
                <div className="text-xs text-zinc-400 dark:text-zinc-500">
                  {desc}
                </div>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded">
                {ext}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TranscriptPanel({
  lines,
  currentTimeMs,
  onSeek,
  videoId,
}: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  const speakerList = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const line of lines) {
      if (line.speaker && !seen.has(line.speaker)) {
        seen.add(line.speaker);
        list.push(line.speaker);
      }
    }
    return list;
  }, [lines]);

  const activeIndex = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].offset <= currentTimeMs) idx = i;
      else break;
    }
    return idx;
  }, [lines, currentTimeMs]);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const item = activeRef.current;
      const itemTop = item.offsetTop;
      const itemBottom = itemTop + item.offsetHeight;
      const containerTop = container.scrollTop;
      const containerBottom = containerTop + container.clientHeight;
      if (itemTop < containerTop || itemBottom > containerBottom) {
        item.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeIndex]);

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
        <svg
          className="w-10 h-10 text-zinc-300 dark:text-zinc-700"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          No captions available for this video
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          Try a video with auto-generated or manual captions enabled.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto bg-white dark:bg-zinc-900"
    >
      {/* Sticky header */}
      <div className="sticky top-0 z-10 px-3 py-2 sm:px-5 sm:py-3 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Transcript
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
            {lines.length} lines
          </span>
        </div>
        <DownloadMenu lines={lines} videoId={videoId} />
      </div>

      {/* Speaker legend */}
      {speakerList.length > 0 && (
        <div className="px-5 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-2">
          <span className="text-xs text-zinc-400 dark:text-zinc-500 self-center">
            Speakers:
          </span>
          {speakerList.map((speaker) => (
            <span
              key={speaker}
              className="text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-full"
            >
              {speaker}
            </span>
          ))}
        </div>
      )}

      {/* Lines */}
      <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
        {lines.map((line, i) => (
          <div key={i} ref={i === activeIndex ? activeRef : null}>
            <TranscriptLineItem
              line={line}
              isActive={i === activeIndex}
              speakerList={speakerList}
              onClick={(offsetMs) => onSeek(offsetMs / 1000)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
