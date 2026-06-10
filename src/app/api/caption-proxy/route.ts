export const runtime = "edge";

const ALLOWED_HOSTS = ["www.youtube.com", "youtube.com"];

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get("url");
  if (!rawUrl) {
    return Response.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return Response.json({ error: "Invalid url" }, { status: 400 });
  }

  // Only proxy YouTube timedtext URLs
  if (
    !ALLOWED_HOSTS.includes(parsed.hostname) ||
    !parsed.pathname.startsWith("/api/timedtext")
  ) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const res = await fetch(rawUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type":
          res.headers.get("Content-Type") ?? "text/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
