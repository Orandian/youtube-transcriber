import type { TranscriptLine } from "@/types/transcript";
import { formatTime } from "./youtube";

function msToSrtTime(ms: number): string {
  const totalMs = Math.round(ms);
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1_000);
  const millis = totalMs % 1_000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function buildTxt(lines: TranscriptLine[]): string {
  return lines
    .map((l) => {
      const speaker = l.speaker ? `[${l.speaker}] ` : "";
      return `${formatTime(l.offset)}  ${speaker}${l.text}`;
    })
    .join("\n");
}

export function buildSrt(lines: TranscriptLine[]): string {
  return lines
    .map((l, i) => {
      const start = msToSrtTime(l.offset);
      const end = msToSrtTime(l.offset + l.duration);
      const speaker = l.speaker ? `<${l.speaker}>\n` : "";
      return `${i + 1}\n${start} --> ${end}\n${speaker}${l.text}`;
    })
    .join("\n\n");
}

export function buildJson(lines: TranscriptLine[]): string {
  return JSON.stringify(lines, null, 2);
}

export function triggerDownload(
  content: string,
  filename: string,
  mime: string,
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
