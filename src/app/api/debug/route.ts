export const runtime = "edge";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("v") || "gCR-WPuE_UA";

  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: "CONSENT=YES+1; VISITOR_INFO1_LIVE=; GPS=1",
    },
    cache: "no-store",
  });

  const html = await res.text();

  return Response.json({
    status: res.status,
    hasCaptionTracks: html.includes('"captionTracks"'),
    hasPlayability: html.includes('"playabilityStatus"'),
    hasRecaptcha: html.includes("recaptcha"),
    hasConsentForm: html.includes("consent"),
    playabilitySnippet:
      html.match(/"playabilityStatus":\{"status":"([^"]+)"/)?.[1] ?? null,
    captionSnippet: html.includes('"captionTracks"')
      ? html.slice(
          html.indexOf('"captionTracks"'),
          html.indexOf('"captionTracks"') + 100,
        )
      : null,
    htmlLength: html.length,
  });
}
