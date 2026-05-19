import { notFound } from "next/navigation";
import { fetchTranscript } from "@/lib/transcript";
import { TranscriptPageShell } from "@/components/TranscriptPageShell";
import type { TranscriptLine } from "@/types/transcript";

interface PageProps {
  params: Promise<{ videoId: string }>;
}

export default async function TranscriptPage({ params }: PageProps) {
  const { videoId } = await params;

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) notFound();

  let lines: TranscriptLine[];
  try {
    lines = await fetchTranscript(videoId);
  } catch (err) {
    console.error(
      "[transcript]",
      videoId,
      err instanceof Error ? err.message : err,
    );
    lines = [];
  }

  return <TranscriptPageShell videoId={videoId} lines={lines} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { videoId } = await params;
  return { title: `Transcript · ${videoId}` };
}
