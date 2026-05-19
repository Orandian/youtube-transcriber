import { NextRequest } from "next/server";
import { z } from "zod";
import { fetchTranscript } from "@/lib/transcript";

export const runtime = "edge";

const querySchema = z.object({
  videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/, "Invalid video ID"),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const parsed = querySchema.safeParse({
    videoId: searchParams.get("videoId"),
  });

  if (!parsed.success) {
    return Response.json({ error: "Invalid video ID" }, { status: 400 });
  }

  try {
    const lines = await fetchTranscript(parsed.data.videoId);
    return Response.json({ lines });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Treat any "no captions" variant as 404 so the browser falls back gracefully
    if (
      message.includes("No captions") ||
      message.includes("Could not get transcripts") ||
      message.includes("disabled") ||
      message.includes("private") ||
      message.includes("restricted")
    ) {
      return Response.json(
        { error: "No captions available for this video.", detail: message },
        { status: 404 },
      );
    }

    return Response.json(
      { error: "Failed to fetch transcript." },
      { status: 500 },
    );
  }
}
