"use client";

interface SpeakerBadgeProps {
  speaker: string;
  colorClasses: { bg: string; text: string; border: string };
}

export function SpeakerBadge({ speaker, colorClasses }: SpeakerBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${colorClasses.bg} ${colorClasses.text} ${colorClasses.border} shrink-0`}
    >
      {speaker}
    </span>
  );
}
