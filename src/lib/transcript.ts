import type { TranscriptLine } from "@/types/transcript";

const INNERTUBE_URL =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

const CLIENTS = [
  {
    name: "ANDROID",
    version: "20.10.38",
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
  },
  {
    name: "IOS",
    version: "19.45.4",
    userAgent:
      "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X)",
  },
  {
    name: "MWEB",
    version: "2.20240726.00.00",
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 16_7_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  },
  {
    name: "WEB",
    version: "2.20231010.04.01",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

async function fetchViaClient(
  videoId: string,
  client: (typeof CLIENTS)[number],
): Promise<{ languageCode: string; baseUrl: string }[] | null> {
  try {
    const res = await fetch(INNERTUBE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": client.userAgent,
      },
      body: JSON.stringify({
        context: {
          client: { clientName: client.name, clientVersion: client.version },
        },
        videoId,
      }),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = await res.json();
    // Log the playability + caption status per client for debugging
    const status = data?.playabilityStatus?.status;
    const trackCount =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length ??
      0;
    console.log(
      `[transcript] ${client.name}: playability=${status} tracks=${trackCount}`,
    );

    const tracks =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    return Array.isArray(tracks) && tracks.length > 0 ? tracks : null;
  } catch (e) {
    console.log(`[transcript] ${client.name} error:`, e);
    return null;
  }
}

export async function fetchTranscript(
  videoId: string,
): Promise<TranscriptLine[]> {
  let tracks: { languageCode: string; baseUrl: string }[] | null = null;
  for (const client of CLIENTS) {
    tracks = await fetchViaClient(videoId, client);
    if (tracks) break;
  }

  if (!tracks) throw new Error("No captions available for this video");

  const track =
    tracks.find((t) => t.languageCode === "en" || t.languageCode === "en-US") ??
    tracks[0];

  const xmlRes = await fetch(track.baseUrl, {
    headers: { "User-Agent": CLIENTS[0].userAgent },
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
