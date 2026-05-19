import type { TranscriptLine } from "@/types/transcript";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

// Keys come from env vars (set in .env.local and Vercel dashboard).
// googleapis.com entries are skipped when keys are absent.
const YT_ANDROID_KEY = process.env.NEXT_PUBLIC_YT_ANDROID_KEY ?? "";
const YT_WEB_KEY = process.env.NEXT_PUBLIC_YT_WEB_KEY ?? "";

const INNERTUBE_CLIENTS: {
  url: string;
  name: string;
  version: string;
  androidSdkVersion?: number;
  userAgent?: string;
  extraHeaders: Record<string, string>;
}[] = [
  ...(YT_ANDROID_KEY
    ? [
        {
          url: `https://youtubei.googleapis.com/youtubei/v1/player?key=${YT_ANDROID_KEY}&prettyPrint=false`,
          name: "ANDROID",
          version: "20.10.38",
          androidSdkVersion: 30,
          userAgent:
            "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
          extraHeaders: {
            "X-YouTube-Client-Name": "3",
            "X-YouTube-Client-Version": "20.10.38",
          },
        },
      ]
    : []),
  ...(YT_WEB_KEY
    ? [
        {
          url: `https://youtubei.googleapis.com/youtubei/v1/player?key=${YT_WEB_KEY}&prettyPrint=false`,
          name: "WEB",
          version: "2.20231219.04.00",
          extraHeaders: {
            "X-YouTube-Client-Name": "1",
            "X-YouTube-Client-Version": "2.20231219.04.00",
          },
        },
      ]
    : []),
  // www.youtube.com always returns LOGIN_REQUIRED from cloud IPs — omitted.
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

function parseCookies(setCookieHeader: string | null): string {
  if (!setCookieHeader) return "";
  return setCookieHeader
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .join("; ");
}

async function tryInnerTube(videoId: string): Promise<CaptionTrack[] | null> {
  console.log(
    `[transcript] clients to try: ${INNERTUBE_CLIENTS.length} (android_key=${!!YT_ANDROID_KEY}, web_key=${!!YT_WEB_KEY})`,
  );
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const res = await fetch(client.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": BROWSER_HEADERS["User-Agent"],
          ...client.extraHeaders,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: client.name,
              clientVersion: client.version,
              ...(client.androidSdkVersion
                ? { androidSdkVersion: client.androidSdkVersion }
                : {}),
              ...(client.userAgent ? { userAgent: client.userAgent } : {}),
              hl: "en",
              gl: "US",
            },
          },
          videoId,
        }),
        signal: AbortSignal.timeout(2500),
        cache: "no-store",
      });
      const host = new URL(client.url).hostname;
      if (!res.ok) {
        console.log(`[transcript] ${client.name}@${host} HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const playability = data?.playabilityStatus?.status;
      const tracks: CaptionTrack[] =
        data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      console.log(
        `[transcript] ${client.name}@${host} playability=${playability} tracks=${tracks.length}`,
      );
      if (tracks.length > 0) return tracks;
    } catch (e) {
      console.log(`[transcript] ${client.name} error: ${e}`);
      continue;
    }
  }
  return null;
}

// Parse lang_code + optional kind from timedtext list XML
function parseTrackList(xml: string): { lang: string; kind: string }[] {
  const out: { lang: string; kind: string }[] = [];
  for (const m of xml.matchAll(/<track\s([^>]+)>/g)) {
    const lang = m[1].match(/lang_code="([^"]+)"/)?.[1];
    const kind = m[1].match(/kind="([^"]+)"/)?.[1] ?? "";
    if (lang) out.push({ lang, kind });
  }
  return out;
}

// Strategy: timedtext list (discovers available languages without InnerTube)
async function tryTimedTextList(videoId: string): Promise<{
  tracks: CaptionTrack[] | null;
  debug: string;
}> {
  try {
    const r = await fetch(
      `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`,
      {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      },
    );
    if (!r.ok) return { tracks: null, debug: `list_http=${r.status}` };

    const xml = await r.text();
    const trackList = parseTrackList(xml);
    const langs = trackList
      .map((t) => t.lang + (t.kind ? "/" + t.kind : ""))
      .join(",");
    console.log(`[transcript] timedtext list: [${langs}]`);

    if (trackList.length === 0)
      return { tracks: null, debug: `list_empty xml_len=${xml.length}` };

    const preferred =
      trackList.find((t) => t.lang === "en" || t.lang === "en-US") ??
      trackList[0];

    return {
      tracks: [
        {
          languageCode: preferred.lang,
          baseUrl: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${preferred.lang}${preferred.kind ? "&kind=" + preferred.kind : ""}&name=&fmt=srv3`,
        },
      ],
      debug: `list_ok langs=[${langs}]`,
    };
  } catch (e) {
    return { tracks: null, debug: `list_error=${e}` };
  }
}

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracks = (player as any)?.captions?.playerCaptionsTracklistRenderer
      ?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) return null;

    return { tracks, cookies };
  } catch {
    return null;
  }
}

const INVIDIOUS_INSTANCES = [
  "https://invidious.privacydev.net",
  "https://iv.melmac.space",
  "https://invidious.projectsegfau.lt",
  "https://inv.tux.pizza",
  "https://yt.artemislena.eu",
  "https://invidious.fdn.fr",
  "https://invidious.nerdvpn.de",
];

function parseVtt(vtt: string): RawEntry[] {
  const results: RawEntry[] = [];
  function parseTs(ts: string): number {
    const parts = ts.trim().replace(",", ".").split(":");
    if (parts.length === 3)
      return (
        (parseInt(parts[0]) * 3600 +
          parseInt(parts[1]) * 60 +
          parseFloat(parts[2])) *
        1000
      );
    return (parseInt(parts[0]) * 60 + parseFloat(parts[1])) * 1000;
  }
  const lines = vtt.split("\n");
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].trim().match(/^([\d:.,]+)\s+-->\s+([\d:.,]+)/);
    if (m) {
      const startMs = parseTs(m[1]);
      const endMs = parseTs(m[2]);
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") {
        const t = lines[i].trim().replace(/<[^>]+>/g, "");
        if (t) textLines.push(t);
        i++;
      }
      const text = textLines.join(" ").trim();
      if (text)
        results.push({ text, offsetMs: startMs, durationMs: endMs - startMs });
    } else {
      i++;
    }
  }
  return results;
}

async function tryOneInvidious(
  instance: string,
  videoId: string,
): Promise<TranscriptLine[]> {
  const listRes = await fetch(`${instance}/api/v1/captions/${videoId}`, {
    signal: AbortSignal.timeout(4000),
    cache: "no-store",
  });
  console.log(`[transcript] ${instance} list status=${listRes.status}`);
  if (!listRes.ok) throw new Error(`${instance} list ${listRes.status}`);
  const data = (await listRes.json()) as {
    captions?: { label: string; language_code: string; url: string }[];
  };
  console.log(
    `[transcript] ${instance} captions=${data.captions?.length ?? 0} langs=${data.captions?.map((c) => c.language_code).join(",")}`,
  );
  if (!Array.isArray(data.captions) || data.captions.length === 0)
    throw new Error(`${instance} no captions`);
  const cap =
    data.captions.find((c) => c.language_code.startsWith("en")) ??
    data.captions[0];
  const vttRes = await fetch(`${instance}${cap.url}`, {
    signal: AbortSignal.timeout(4000),
    cache: "no-store",
  });
  if (!vttRes.ok) throw new Error(`${instance} vtt ${vttRes.status}`);
  const entries = parseVtt(await vttRes.text());
  if (entries.length === 0) throw new Error(`${instance} empty vtt`);
  console.log(`[transcript] invidious OK (${instance})`);
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

async function tryInvidious(
  videoId: string,
): Promise<{ lines: TranscriptLine[] | null; debug: string }> {
  return Promise.any(
    INVIDIOUS_INSTANCES.map((inst) => tryOneInvidious(inst, videoId)),
  )
    .then((lines) => ({ lines, debug: "invidious_ok" }))
    .catch((e: unknown) => {
      const agg = e as { errors?: Error[] };
      const msgs = (agg.errors ?? [])
        .slice(0, 5)
        .map((err) => err.message)
        .join(" | ");
      console.log(`[transcript] invidious all failed: ${msgs}`);
      return { lines: null, debug: `inv_fail: ${msgs.slice(0, 120)}` };
    });
}

// Embed page — YouTube may be less restrictive here since embeds must work everywhere
async function tryEmbedPage(videoId: string): Promise<CaptionTrack[] | null> {
  try {
    const res = await fetch(`https://www.youtube.com/embed/${videoId}?hl=en`, {
      headers: { ...BROWSER_HEADERS, Referer: "https://www.youtube.com/" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const player = parseInlineJson(html, "ytInitialPlayerResponse");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracks = (player as any)?.captions?.playerCaptionsTracklistRenderer
      ?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (player as any)?.playabilityStatus?.status;
      console.log(`[transcript] embed page playability=${status}`);
      return null;
    }
    console.log(`[transcript] embed page tracks=${tracks.length}`);
    return tracks;
  } catch (e) {
    console.log(`[transcript] embed page error: ${e}`);
    return null;
  }
}

export async function fetchTranscript(
  videoId: string,
): Promise<TranscriptLine[]> {
  let tracks: CaptionTrack[] | null = null;
  let cookies = "";

  // Run all server-side strategies concurrently
  const [it, ttResult, embedTracks] = await Promise.all([
    tryInnerTube(videoId).catch(() => null),
    tryTimedTextList(videoId),
    tryEmbedPage(videoId).catch(() => null),
  ]);
  tracks = it ?? ttResult.tracks ?? embedTracks;
  const timedTextDebug = ttResult.debug;

  if (!tracks) {
    const result = await tryWatchPage(videoId);
    if (result) {
      tracks = result.tracks;
      cookies = result.cookies;
    }
  }

  let invDebug = "";
  if (!tracks) {
    const { lines: inv, debug } = await tryInvidious(videoId);
    invDebug = debug;
    if (inv) return inv;
  }

  if (!tracks)
    throw new Error(
      `No captions available. keys=${YT_ANDROID_KEY ? "android" : ""}${YT_WEB_KEY ? "+web" : ""} ${timedTextDebug} | ${invDebug}`,
    );

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
