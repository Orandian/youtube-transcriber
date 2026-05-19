"use client";

export type LayoutMode = "left" | "right" | "vertical";

interface LayoutToggleProps {
  mode: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}

const MODES: { value: LayoutMode; title: string; icon: React.ReactNode }[] = [
  {
    value: "left",
    title: "Video left, transcript right",
    icon: (
      <svg viewBox="0 0 20 14" className="w-5 h-3.5" fill="currentColor">
        <rect x="0" y="0" width="9" height="14" rx="1.5" />
        <rect x="11" y="0" width="9" height="3" rx="1" opacity="0.35" />
        <rect x="11" y="5" width="9" height="2" rx="1" opacity="0.25" />
        <rect x="11" y="9" width="7" height="2" rx="1" opacity="0.25" />
      </svg>
    ),
  },
  {
    value: "right",
    title: "Transcript left, video right",
    icon: (
      <svg viewBox="0 0 20 14" className="w-5 h-3.5" fill="currentColor">
        <rect x="11" y="0" width="9" height="14" rx="1.5" />
        <rect x="0" y="0" width="9" height="3" rx="1" opacity="0.35" />
        <rect x="0" y="5" width="9" height="2" rx="1" opacity="0.25" />
        <rect x="0" y="9" width="7" height="2" rx="1" opacity="0.25" />
      </svg>
    ),
  },
  {
    value: "vertical",
    title: "Video top, transcript bottom",
    icon: (
      <svg viewBox="0 0 20 14" className="w-5 h-3.5" fill="currentColor">
        <rect x="0" y="0" width="20" height="7" rx="1.5" />
        <rect x="0" y="9" width="20" height="2" rx="1" opacity="0.35" />
        <rect x="0" y="12" width="14" height="2" rx="1" opacity="0.25" />
      </svg>
    ),
  },
];

export function LayoutToggle({ mode, onChange }: LayoutToggleProps) {
  return (
    <div className="hidden lg:flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
      {MODES.map(({ value, title, icon }) => (
        <button
          key={value}
          type="button"
          title={title}
          onClick={() => onChange(value)}
          className={`flex items-center justify-center px-2.5 py-1.5 rounded-md transition-all ${
            mode === value
              ? "bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 shadow-sm"
              : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
