import type { TranscriptLine } from "@/types/transcript";

// InnerTube Android client — works from server-side IPs (Vercel, etc.)
// Browser-based scraping gets blocked by YouTube on cloud IPs.
const CLIENT_VERSION = "20.10.38";
const INNERTUBE_URL =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const ANDROID_UA = `com.google.android.youtube/${CLIENT_VERSION} (Linux; U; Android 14)`;

const SPEAKER_REGEX = /^\[([^\]]+)\]:\s*|^([A-Z][a-zA-Z\s]+):\s+/;

function detectSpeaker(text: string): { speaker?: string; cleanText: string } {
  const match = text.match(SPEAKER_REGEX);
  if (match) {
    return {
      speaker: (match[1] || match[2]).trim(),
      cleanText: text.slice(match[0].length).trim(),
    };
  }
  return { cleanText: text };
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\n/g, " ")
    .trim();
}

interface RawEntry {
  text: string;
  offsetMs: number;
  durationMs: number;
}

function parseCaptionXml(xml: string): RawEntry[] {
  const results: RawEntry[] = [];
  let m;

  // srv3 format: <p t="ms" d="ms"><s>word</s></p>
  const pRe = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  while ((m = pRe.exec(xml)) !== null) {
    const inner = m[3];
    let text = "";
    const sRe = /<s[^>]*>([^<]*)<\/s>/g;
    let sm;
    while ((sm = sRe.exec(inner)) !== null) text += sm[1];
    if (!text) text = inner.replace(/<[^>]+>/g, "");
    text = decodeEntities(text);
    if (text)
      results.push({
        text,
        offsetMs: parseInt(m[1], 10),
        durationMs: parseInt(m[2], 10),
      });
  }

  // Classic fallback: <text start="s" dur="s">text</text>
  if (results.length === 0) {
    const tRe = /<text start="([^"]+)" dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;
    while ((m = tRe.exec(xml)) !== null) {
      const text = decodeEntities(m[3].replace(/<[^>]+>/g, ""));
      if (text)
        results.push({
          text,
          offsetMs: Math.round(parseFloat(m[1]) * 1000),
          durationMs: Math.round(parseFloat(m[2] || "2") * 1000),
        });
    }
  }

  return results;
}

export async function fetchTranscript(
  videoId: string,
): Promise<TranscriptLine[]> {
  // Step 1 — get caption track list via InnerTube Android
  const playerRes = await fetch(INNERTUBE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": ANDROID_UA },
    body: JSON.stringify({
      context: {
        client: { clientName: "ANDROID", clientVersion: CLIENT_VERSION },
      },
      videoId,
    }),
    cache: "no-store",
  });

  if (!playerRes.ok) throw new Error(`InnerTube returned ${playerRes.status}`);

  const player = await playerRes.json();
  const tracks: { languageCode: string; baseUrl: string }[] =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error("No captions available for this video");
  }

  // Prefer English, fall back to first available
  const track =
    tracks.find((t) => t.languageCode === "en" || t.languageCode === "en-US") ??
    tracks[0];

  // Step 2 — fetch caption XML
  const xmlRes = await fetch(track.baseUrl, {
    headers: { "User-Agent": ANDROID_UA },
    cache: "no-store",
  });

  if (!xmlRes.ok) throw new Error(`Caption XML returned ${xmlRes.status}`);

  const xml = await xmlRes.text();
  const entries = parseCaptionXml(xml);

  if (entries.length === 0)
    throw new Error("No captions available for this video");

  return entries.map(({ text, offsetMs, durationMs }) => {
    const { speaker, cleanText } = detectSpeaker(text);
    return {
      text: cleanText,
      offset: offsetMs,
      duration: durationMs,
      ...(speaker ? { speaker } : {}),
    };
  });
}
