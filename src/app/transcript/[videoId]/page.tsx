import { notFound } from "next/navigation";
import { TranscriptPageShell } from "@/components/TranscriptPageShell";

interface PageProps {
  params: Promise<{ videoId: string }>;
}

export default async function TranscriptPage({ params }: PageProps) {
  const { videoId } = await params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) notFound();
  return <TranscriptPageShell videoId={videoId} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { videoId } = await params;
  return { title: `Transcript · ${videoId}` };
}
