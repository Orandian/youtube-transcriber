"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseYouTubePlayerOptions {
  videoId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onReady?: (player: YT.Player) => void;
}

export function useYouTubePlayer({
  videoId,
  containerRef,
  onReady,
}: UseYouTubePlayerOptions) {
  const playerRef = useRef<YT.Player | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const initPlayer = useCallback(() => {
    if (!containerRef.current || playerRef.current) return;

    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId,
      playerVars: {
        modestbranding: 1,
        rel: 0,
        enablejsapi: 1,
      },
      events: {
        onReady: (event) => {
          setPlayerReady(true);
          onReady?.(event.target);
          intervalRef.current = setInterval(() => {
            if (playerRef.current) {
              setCurrentTime(playerRef.current.getCurrentTime() * 1000);
            }
          }, 500);
        },
      },
    });
  }, [videoId, containerRef, onReady]);

  useEffect(() => {
    const loadAPI = () => {
      if (window.YT && window.YT.Player) {
        initPlayer();
        return;
      }

      const w = window as typeof window & {
        onYouTubeIframeAPIReady?: () => void;
      };
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        prev?.();
        initPlayer();
      };

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
    };

    loadAPI();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    };
  }, [initPlayer]);

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
    playerRef.current?.playVideo();
  }, []);

  return { playerReady, currentTime, seekTo };
}
