import type { TranscriptLine } from "@/types/transcript";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

// googleapis.com is Google's public API domain — different IP policy than www.youtube.com,
// accepts requests from any IP without LOGIN_REQUIRED.
const INNERTUBE_CLIENTS = [
  {
    url: "https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false",
    name: "GOOGLEAPIS_WEB",
    version: "2.20231219.04.00",
  },
  {
    url: "https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false",
    name: "GOOGLEAPIS_ANDROID",
    version: "20.10.38",
  },
  {
    url: "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    name: "WEB",
    version: "2.20231010.04.01",
  },
  {
    url: "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    name: "ANDROID",
    version: "20.10.38",
  },
  {
    url: "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    name: "IOS",
    version: "19.45.4",
  },
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
interface CaptionTrack {
  languageCode: string;
  baseUrl: string;
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

// Properly extract a top-level JSON object assigned to `var NAME = {...}` in HTML
function parseInlineJson(
  html: string,
  varName: string,
): Record<string, unknown> | null {
  const token = `var ${varName} = `;
  const start = html.indexOf(token);
  if (start === -1) return null;
  const jsonStart = start + token.length;
  let depth = 0;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(jsonStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// Condense Set-Cookie headers into a single Cookie string
function parseCookies(setCookieHeader: string | null): string {
  if (!setCookieHeader) return "";
  return setCookieHeader
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .join("; ");
}

// ── Strategy 1: InnerTube API ─────────────────────────────────────────────────
async function tryInnerTube(videoId: string): Promise<CaptionTrack[] | null> {
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const clientName = client.name.replace("GOOGLEAPIS_", "");
      const res = await fetch(client.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": BROWSER_HEADERS["User-Agent"],
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName,
              clientVersion: client.version,
              hl: "en",
              gl: "US",
            },
          },
          videoId,
        }),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = await res.json();
      const tracks =
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(tracks) && tracks.length > 0) return tracks;
    } catch {
      continue;
    }
  }
  return null;
}

// ── Strategy 2: Watch page HTML scraping (fallback for LOGIN_REQUIRED) ───────
async function tryWatchPage(
  videoId: string,
): Promise<{ tracks: CaptionTrack[]; cookies: string } | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
    });
    if (!res.ok) return null;

    const cookies = parseCookies(res.headers.get("set-cookie"));
    const html = await res.text();

    const player = parseInlineJson(html, "ytInitialPlayerResponse");
    const tracks = (player as any)?.captions?.playerCaptionsTracklistRenderer
      ?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) return null;

    return { tracks, cookies };
  } catch {
    return null;
  }
}

export async function fetchTranscript(
  videoId: string,
): Promise<TranscriptLine[]> {
  let tracks: CaptionTrack[] | null = null;
  let cookies = "";

  // Try InnerTube first (no extra request overhead)
  tracks = await tryInnerTube(videoId);

  // Fall back to HTML scraping if InnerTube returns no tracks (cloud IP restriction)
  if (!tracks) {
    const result = await tryWatchPage(videoId);
    if (result) {
      tracks = result.tracks;
      cookies = result.cookies;
    }
  }

  if (!tracks) throw new Error("No captions available for this video");

  const track =
    tracks.find((t) => t.languageCode === "en" || t.languageCode === "en-US") ??
    tracks[0];

  const xmlHeaders: Record<string, string> = { ...BROWSER_HEADERS };
  if (cookies) xmlHeaders["Cookie"] = cookies;

  const xmlRes = await fetch(track.baseUrl, {
    headers: xmlHeaders,
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
