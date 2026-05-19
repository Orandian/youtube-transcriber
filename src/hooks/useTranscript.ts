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

// ── Strategy 2: timedtext GET directly from browser (CORS-enabled GET) ────────
async function fetchTimedText(
  videoId: string,
): Promise<{ text: string; offsetMs: number; durationMs: number }[] | null> {
  const candidates = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-US&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-US&kind=asr&fmt=json3`,
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const data = await r.json();
      const entries = parseJson3(data);
      if (entries.length > 0) {
        console.log(`[useTranscript] timedtext OK`);
        return entries;
      }
    } catch (e) {
      console.warn("[useTranscript] timedtext failed:", e);
    }
  }
  return null;
}

// ── Strategy 3: InnerTube from browser (googleapis.com has CORS) ──────────────
async function fetchViaInnerTube(
  videoId: string,
): Promise<{ text: string; offsetMs: number; durationMs: number }[] | null> {
  const clients = [
    // googleapis.com is the Google API domain — has CORS headers + different IP policy
    {
      url: "https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false",
      ctx: {
        clientName: "WEB",
        clientVersion: "2.20231219.04.00",
        hl: "en",
        gl: "US",
      },
    },
    {
      url: "https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false",
      ctx: {
        clientName: "ANDROID",
        clientVersion: "20.10.38",
        hl: "en",
        gl: "US",
      },
    },
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
        if (cancelled) return;
        if (innerTubeEntries && innerTubeEntries.length > 0) {
          setLines(toLines(innerTubeEntries));
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
