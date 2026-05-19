"use client";

import type { TranscriptLine } from "@/types/transcript";
import { SpeakerBadge } from "./SpeakerBadge";
import { getSpeakerColor } from "@/lib/speakerColors";
import { formatTime } from "@/lib/youtube";

interface TranscriptLineItemProps {
  line: TranscriptLine;
  isActive: boolean;
  speakerList: string[];
  onClick: (offsetMs: number) => void;
}

export function TranscriptLineItem({
  line,
  isActive,
  speakerList,
  onClick,
}: TranscriptLineItemProps) {
  const colorClasses = line.speaker
    ? getSpeakerColor(line.speaker, speakerList)
    : null;

  return (
    <button
      type="button"
      onClick={() => onClick(line.offset)}
      className={`
        w-full text-left px-3 py-2.5 sm:px-5 sm:py-3.5 border-l-[3px] transition-all duration-150
        ${
          isActive
            ? "bg-amber-50 dark:bg-amber-950/30 border-l-amber-400 dark:border-l-amber-600"
            : "border-l-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:border-l-zinc-200 dark:hover:border-l-zinc-700"
        }
      `}
    >
      <div className="flex items-start gap-4">
        <span
          className={`text-[11px] font-mono tabular-nums shrink-0 mt-1 px-1.5 py-0.5 rounded ${
            isActive
              ? "bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300"
              : "text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800"
          }`}
        >
          {formatTime(line.offset)}
        </span>

        <div className="flex flex-col gap-1.5 min-w-0">
          {line.speaker && colorClasses && (
            <SpeakerBadge speaker={line.speaker} colorClasses={colorClasses} />
          )}
          <p
            className={`text-[13px] sm:text-[15px] leading-[1.65] break-words ${
              isActive
                ? "text-zinc-900 dark:text-zinc-50 font-[500]"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {line.text}
          </p>
        </div>
      </div>
    </button>
  );
}
