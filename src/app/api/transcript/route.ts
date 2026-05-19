export const runtime = "edge";

import { NextRequest } from "next/server";
import { z } from "zod";
import { fetchTranscript } from "@/lib/transcript";

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

    if (
      message.includes("Could not get transcripts") ||
      message.includes("disabled")
    ) {
      return Response.json(
        { error: "No captions available for this video." },
        { status: 404 },
      );
    }
    if (message.includes("private") || message.includes("restricted")) {
      return Response.json(
        { error: "This video is private or restricted." },
        { status: 403 },
      );
    }

    return Response.json(
      { error: "Failed to fetch transcript.", detail: message },
      { status: 500 },
    );
  }
}
