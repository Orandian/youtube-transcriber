"use client";

import { useRef, useEffect } from "react";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";

interface VideoPanelProps {
  videoId: string;
  onSeekReady: (seekFn: (seconds: number) => void) => void;
  onTimeUpdate: (ms: number) => void;
}

export function VideoPanel({
  videoId,
  onSeekReady,
  onTimeUpdate,
}: VideoPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSeekReadyRef = useRef(onSeekReady);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  useEffect(() => {
    onSeekReadyRef.current = onSeekReady;
  }, [onSeekReady]);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  const { playerReady, currentTime, seekTo } = useYouTubePlayer({
    videoId,
    containerRef,
  });

  useEffect(() => {
    if (playerReady) onSeekReadyRef.current(seekTo);
  }, [playerReady, seekTo]);

  useEffect(() => {
    onTimeUpdateRef.current(currentTime);
  }, [currentTime]);

  // Fills whatever container the parent gives it — sizing is the parent's responsibility
  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
