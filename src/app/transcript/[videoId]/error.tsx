"use client";

import Link from "next/link";

interface ErrorProps {
  error: Error;
  reset: () => void;
}

export default function TranscriptError({ error, reset }: ErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 text-center bg-zinc-50">
      <div className="flex flex-col items-center gap-3 max-w-md">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <svg
            className="w-7 h-7 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-zinc-800">
          Could not load transcript
        </h1>
        <p className="text-sm text-zinc-500 leading-relaxed">
          {error.message ||
            "This video may be private, age-restricted, or have captions disabled."}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
