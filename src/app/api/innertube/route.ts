export const runtime = "edge";

const ANDROID_KEY = process.env.NEXT_PUBLIC_YT_ANDROID_KEY ?? "";

export async function POST(request: Request) {
  if (!ANDROID_KEY) {
    return Response.json({ error: "No API key configured" }, { status: 500 });
  }
  try {
    const body = await request.text();
    const res = await fetch(
      `https://youtubei.googleapis.com/youtubei/v1/player?key=${ANDROID_KEY}&prettyPrint=false`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      },
    );
    const data = await res.text();
    return new Response(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
