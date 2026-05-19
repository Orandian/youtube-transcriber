export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();

  // Plain 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);

    // youtube.com/watch?v=ID
    if (url.hostname.includes("youtube.com") && url.pathname === "/watch") {
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    }

    // youtu.be/ID
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1);
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // youtube.com/embed/ID or youtube.com/shorts/ID
    const pathMatch = url.pathname.match(
      /^\/(embed|shorts)\/([a-zA-Z0-9_-]{11})/,
    );
    if (pathMatch) return pathMatch[2];
  } catch {
    // not a valid URL
  }

  return null;
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
