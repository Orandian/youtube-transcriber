"use client";

import { useState, useEffect } from "react";
import type { TranscriptLine } from "@/types/transcript";

export type TranscriptStatus = "loading" | "ready" | "empty" | "error";

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

function parseJson3(
  data: unknown,
): { text: string; offsetMs: number; durationMs: number }[] {
  const results: { text: string; offsetMs: number; durationMs: number }[] = [];
  const events = (data as { events?: unknown[] })?.events;
  if (!Array.isArray(events)) return results;
  for (const ev of events) {
    const e = ev as {
      tStartMs?: number;
      dDurationMs?: number;
      segs?: { utf8?: string }[];
    };
    if (e.tStartMs == null || !Array.isArray(e.segs)) continue;
    const text = e.segs
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\n/g, " ")
      .trim();
    if (!text) continue;
    results.push({
      text,
      offsetMs: e.tStartMs,
      durationMs: e.dDurationMs ?? 2000,
    });
  }
  return results;
}

function parseCaptionXml(
  xml: string,
): { text: string; offsetMs: number; durationMs: number }[] {
  const results: { text: string; offsetMs: number; durationMs: number }[] = [];
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

function toLines(
  entries: { text: string; offsetMs: number; durationMs: number }[],
): TranscriptLine[] {
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

// ── Strategy 1: our own API route (server-side proxy, no CORS, browser-safe) ──
async function fetchViaApiRoute(
  videoId: string,
): Promise<TranscriptLine[] | null> {
  try {
    const r = await fetch(`/api/transcript?videoId=${videoId}`);
    if (!r.ok) {
      console.warn(`[useTranscript] API route ${r.status}`);
      return null;
    }
    const data = await r.json();
    if (Array.isArray(data.lines) && data.lines.length > 0) {
      console.log("[useTranscript] API route OK");
      return data.lines as TranscriptLine[];
    }
  } catch (e) {
    console.warn("[useTranscript] API route error:", e);
  }
  return null;
}

// ── Strategy 2: timedtext (language-aware) ────────────────────────────────────
async function fetchTimedText(
  videoId: string,
): Promise<{ text: string; offsetMs: number; durationMs: number }[] | null> {
  // Step 1: discover available languages via timedtext list (CORS-enabled)
  let langCandidates: { lang: string; kind: string }[] = [];
  try {
    const listRes = await fetch(
      `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`,
    );
    if (listRes.ok) {
      const xml = await listRes.text();
      for (const m of xml.matchAll(/<track\s([^>]+)>/g)) {
        const lang = m[1].match(/lang_code="([^"]+)"/)?.[1];
        const kind = m[1].match(/kind="([^"]+)"/)?.[1] ?? "";
        if (lang) langCandidates.push({ lang, kind });
      }
      console.log(
        `[useTranscript] timedtext list: ${langCandidates.map((t) => t.lang).join(",")}`,
      );
    }
  } catch {}

  // Prefer English, fall back to whatever is available, finally try en anyway
  const ordered = [
    ...langCandidates.filter((t) => t.lang === "en" || t.lang === "en-US"),
    ...langCandidates.filter((t) => t.lang !== "en" && t.lang !== "en-US"),
    { lang: "en", kind: "" },
    { lang: "en", kind: "asr" },
  ];

  for (const { lang, kind } of ordered) {
    try {
      const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}${kind ? "&kind=" + kind : ""}&name=&fmt=json3`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const data = await r.json();
      const entries = parseJson3(data);
      if (entries.length > 0) {
        console.log(`[useTranscript] timedtext OK lang=${lang}`);
        return entries;
      }
    } catch (e) {
      console.warn("[useTranscript] timedtext failed:", e);
    }
  }
  return null;
}

// ── Strategy 3: InnerTube from browser (via CF Worker or googleapis.com) ─────
async function fetchViaInnerTube(
  videoId: string,
): Promise<{ text: string; offsetMs: number; durationMs: number }[] | null> {
  const cfWorkerUrl = process.env.NEXT_PUBLIC_CF_WORKER_URL;
  const androidKey = process.env.NEXT_PUBLIC_YT_ANDROID_KEY;
  const webKey = process.env.NEXT_PUBLIC_YT_WEB_KEY;

  const clients = [
    // Our own /api/innertube Edge proxy — same-origin (no CORS), runs on Cloudflare IPs
    {
      url: "/api/innertube",
      ctx: {
        clientName: "ANDROID",
        clientVersion: "20.10.38",
        androidSdkVersion: 30,
        userAgent:
          "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
        hl: "en",
        gl: "US",
      },
    },
    // CF Worker fallback
    ...(cfWorkerUrl
      ? [
          {
            url: cfWorkerUrl,
            ctx: {
              clientName: "ANDROID",
              clientVersion: "20.10.38",
              androidSdkVersion: 30,
              userAgent:
                "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
              hl: "en",
              gl: "US",
            },
          },
        ]
      : []),
    // googleapis.com + API key — CORS blocked in practice; kept as last-resort
    ...(androidKey
      ? [
          {
            url: `https://youtubei.googleapis.com/youtubei/v1/player?key=${androidKey}&prettyPrint=false`,
            ctx: {
              clientName: "ANDROID",
              clientVersion: "20.10.38",
              androidSdkVersion: 30,
              userAgent:
                "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
              hl: "en",
              gl: "US",
            },
          },
        ]
      : []),
    ...(webKey
      ? [
          {
            url: `https://youtubei.googleapis.com/youtubei/v1/player?key=${webKey}&prettyPrint=false`,
            ctx: {
              clientName: "WEB",
              clientVersion: "2.20231219.04.00",
              hl: "en",
              gl: "US",
            },
          },
        ]
      : []),
    // www.youtube.com as final fallback
    {
      url: "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      ctx: {
        clientName: "WEB",
        clientVersion: "2.20231219.04.00",
        hl: "en",
        gl: "US",
      },
    },
    {
      url: "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      ctx: {
        clientName: "ANDROID",
        clientVersion: "20.10.38",
        hl: "en",
        gl: "US",
      },
    },
  ];

  for (const { url, ctx } of clients) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: { client: ctx }, videoId }),
      });
      if (!r.ok) {
        console.warn(
          `[useTranscript] InnerTube ${ctx.clientName} HTTP ${r.status}`,
        );
        continue;
      }
      const player = await r.json();
      const tracks: { languageCode: string; baseUrl: string }[] =
        player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!Array.isArray(tracks) || tracks.length === 0) {
        console.warn(
          `[useTranscript] InnerTube ${ctx.clientName}: no tracks. playability:`,
          player?.playabilityStatus?.status,
        );
        continue;
      }
      const track =
        tracks.find(
          (t) => t.languageCode === "en" || t.languageCode === "en-US",
        ) ?? tracks[0];
      const xmlRes = await fetch(track.baseUrl);
      if (!xmlRes.ok) {
        console.warn(`[useTranscript] caption XML ${xmlRes.status}`);
        continue;
      }
      const xml = await xmlRes.text();
      const entries = parseCaptionXml(xml);
      if (entries.length > 0) {
        console.log(`[useTranscript] InnerTube ${ctx.clientName} OK`);
        return entries;
      }
    } catch (e) {
      console.warn(`[useTranscript] InnerTube ${ctx.clientName} error:`, e);
    }
  }
  return null;
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

function parseVtt(
  vtt: string,
): { text: string; offsetMs: number; durationMs: number }[] {
  const results: { text: string; offsetMs: number; durationMs: number }[] = [];
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
    signal: AbortSignal.timeout(5000),
  });
  if (!listRes.ok) throw new Error(`${instance} HTTP ${listRes.status}`);
  const data = (await listRes.json()) as {
    captions?: { label: string; language_code: string; url: string }[];
  };
  if (!Array.isArray(data.captions) || data.captions.length === 0)
    throw new Error(`${instance} no captions`);
  const cap =
    data.captions.find((c) => c.language_code.startsWith("en")) ??
    data.captions[0];
  const vttRes = await fetch(`${instance}${cap.url}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!vttRes.ok) throw new Error(`${instance} VTT ${vttRes.status}`);
  const entries = parseVtt(await vttRes.text());
  if (entries.length === 0) throw new Error(`${instance} empty VTT`);
  console.log(`[useTranscript] invidious OK (${instance})`);
  return toLines(entries);
}

async function fetchViaInvidious(
  videoId: string,
): Promise<TranscriptLine[] | null> {
  return Promise.any(
    INVIDIOUS_INSTANCES.map((inst) => tryOneInvidious(inst, videoId)),
  ).catch((e) => {
    console.warn("[useTranscript] all invidious failed:", e);
    return null;
  });
}

export function useTranscript(videoId: string) {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [status, setStatus] = useState<TranscriptStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      setLines([]);

      try {
        // 1. Server-side proxy via our API route (no CORS, server can use any headers)
        const apiLines = await fetchViaApiRoute(videoId);
        if (!cancelled && apiLines && apiLines.length > 0) {
          setLines(apiLines);
          setStatus("ready");
          return;
        }

        // 2. Browser-direct timedtext (simple GET, CORS-enabled)
        const timedTextEntries = await fetchTimedText(videoId);
        if (!cancelled && timedTextEntries && timedTextEntries.length > 0) {
          setLines(toLines(timedTextEntries));
          setStatus("ready");
          return;
        }

        // 3. Browser-direct InnerTube via googleapis.com (has CORS headers)
        const innerTubeEntries = await fetchViaInnerTube(videoId);
        if (!cancelled && innerTubeEntries && innerTubeEntries.length > 0) {
          setLines(toLines(innerTubeEntries));
          setStatus("ready");
          return;
        }

        // 4. Invidious proxy (CORS-enabled, non-cloud servers)
        const invLines = await fetchViaInvidious(videoId);
        if (cancelled) return;
        if (invLines && invLines.length > 0) {
          setLines(invLines);
          setStatus("ready");
          return;
        }

        setStatus("empty");
      } catch (e) {
        console.error("[useTranscript] fatal:", e);
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  return { lines, status };
}
