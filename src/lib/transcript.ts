import type { TranscriptLine } from "@/types/transcript";

const INNERTUBE_URL =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const CLIENTS = [
  { name: "ANDROID", version: "20.10.38" },
  { name: "IOS", version: "19.45.4" },
  { name: "WEB", version: "2.20231010.04.01" },
];

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
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
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

// Fetch a VISITOR_DATA token from YouTube so InnerTube requests look like a real session.
// Without this, cloud IPs get LOGIN_REQUIRED for many videos.
async function getVisitorData(): Promise<string | null> {
  try {
    const html = await fetch("https://www.youtube.com/", {
      headers: BROWSER_HEADERS,
      cache: "no-store",
    }).then((r) => r.text());
    return html.match(/"VISITOR_DATA":"([^"]+)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function fetchTranscript(
  videoId: string,
): Promise<TranscriptLine[]> {
  const visitorData = await getVisitorData();

  let tracks: { languageCode: string; baseUrl: string }[] | null = null;

  for (const client of CLIENTS) {
    try {
      const res = await fetch(INNERTUBE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": BROWSER_HEADERS["User-Agent"],
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: client.name,
              clientVersion: client.version,
              hl: "en",
              gl: "US",
              ...(visitorData ? { visitorData } : {}),
            },
          },
          videoId,
        }),
        cache: "no-store",
      });

      if (!res.ok) continue;
      const data = await res.json();
      const t = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(t) && t.length > 0) {
        tracks = t;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!tracks) throw new Error("No captions available for this video");

  const track =
    tracks.find((t) => t.languageCode === "en" || t.languageCode === "en-US") ??
    tracks[0];

  const xmlRes = await fetch(track.baseUrl, {
    headers: BROWSER_HEADERS,
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
