export const SPEAKER_COLORS = [
  {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300",
    active: "bg-blue-50 border-l-blue-400",
  },
  {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300",
    active: "bg-emerald-50 border-l-emerald-400",
  },
  {
    bg: "bg-violet-100",
    text: "text-violet-800",
    border: "border-violet-300",
    active: "bg-violet-50 border-l-violet-400",
  },
  {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-300",
    active: "bg-amber-50 border-l-amber-400",
  },
  {
    bg: "bg-rose-100",
    text: "text-rose-800",
    border: "border-rose-300",
    active: "bg-rose-50 border-l-rose-400",
  },
  {
    bg: "bg-cyan-100",
    text: "text-cyan-800",
    border: "border-cyan-300",
    active: "bg-cyan-50 border-l-cyan-400",
  },
];

export function getSpeakerColor(speaker: string, speakerList: string[]) {
  const index = speakerList.indexOf(speaker);
  return SPEAKER_COLORS[Math.max(0, index) % SPEAKER_COLORS.length];
}
