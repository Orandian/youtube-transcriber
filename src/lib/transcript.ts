import { YoutubeTranscript } from "youtube-transcript";
import type { TranscriptLine } from "@/types/transcript";

// Detects "[Speaker Name]:" or "Speaker Name: " patterns at line start
const SPEAKER_REGEX = /^\[([^\]]+)\]:\s*|^([A-Z][a-zA-Z\s]+):\s+/;

function detectSpeaker(text: string): { speaker?: string; cleanText: string } {
  const match = text.match(SPEAKER_REGEX);
  if (match) {
    const speaker = (match[1] || match[2]).trim();
    const cleanText = text.slice(match[0].length).trim();
    return { speaker, cleanText };
  }
  return { cleanText: text };
}

export async function fetchTranscript(
  videoId: string,
): Promise<TranscriptLine[]> {
  const raw = await YoutubeTranscript.fetchTranscript(videoId);

  return raw.map((entry) => {
    const { speaker, cleanText } = detectSpeaker(entry.text);
    return {
      text: cleanText,
      offset: Math.round(entry.offset),
      duration: Math.round(entry.duration),
      ...(speaker ? { speaker } : {}),
    };
  });
}
