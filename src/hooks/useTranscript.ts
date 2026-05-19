"use client";

import { useState, useEffect } from "react";
import type { TranscriptLine } from "@/types/transcript";

const INNERTUBE_URL =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
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

function parseCaptionXml(
  xml: string,
): { text: string; offsetMs: number; durationMs: number }[] {
  const results: { text: string; offsetMs: number; durationMs: number }[] = [];
  let m;

  // srv3: <p t="ms" d="ms" ...>
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

  // Classic: <text start="s" dur="s">
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

export type TranscriptStatus = "loading" | "ready" | "empty" | "error";

export function useTranscript(videoId: string) {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [status, setStatus] = useState<TranscriptStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      setLines([]);

      try {
        // 1. Get caption tracks via InnerTube — called from user's browser (residential IP)
        //    YouTube allows CORS and returns captions that it would block from cloud servers
        const res = await fetch(INNERTUBE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: {
              client: {
                clientName: "ANDROID",
                clientVersion: "20.10.38",
                hl: "en",
                gl: "US",
              },
            },
            videoId,
          }),
        });

        if (!res.ok) throw new Error(`InnerTube ${res.status}`);
        const player = await res.json();

        const tracks: { languageCode: string; baseUrl: string }[] =
          player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

        if (!Array.isArray(tracks) || tracks.length === 0) {
          if (!cancelled) setStatus("empty");
          return;
        }

        const track =
          tracks.find(
            (t) => t.languageCode === "en" || t.languageCode === "en-US",
          ) ?? tracks[0];

        // 2. Fetch caption XML
        const xmlRes = await fetch(track.baseUrl);
        if (!xmlRes.ok) throw new Error(`Caption XML ${xmlRes.status}`);
        const xml = await xmlRes.text();

        const entries = parseCaptionXml(xml);
        if (cancelled) return;

        if (entries.length === 0) {
          setStatus("empty");
          return;
        }

        const result: TranscriptLine[] = entries.map(
          ({ text, offsetMs, durationMs }) => {
            const { speaker, cleanText } = detectSpeaker(text);
            return {
              text: cleanText,
              offset: offsetMs,
              duration: durationMs,
              ...(speaker ? { speaker } : {}),
            };
          },
        );

        setLines(result);
        setStatus("ready");
      } catch {
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
