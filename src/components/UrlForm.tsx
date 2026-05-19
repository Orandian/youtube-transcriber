"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { extractVideoId } from "@/lib/youtube";

export function UrlForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const videoId = extractVideoId(url);
    if (!videoId) {
      setError(
        "That doesn't look like a YouTube link. Try https://youtube.com/watch?v=...",
      );
      return;
    }

    setLoading(true);
    router.push(`/transcript/${videoId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
      <div
        className={`flex items-center bg-white dark:bg-zinc-900 rounded-2xl border-2 transition-all shadow-md ${
          error
            ? "border-red-300 dark:border-red-700"
            : "border-zinc-200 dark:border-zinc-700 focus-within:border-zinc-900 dark:focus-within:border-zinc-400"
        }`}
      >
        {/* YouTube icon */}
        <div className="pl-4 pr-3 shrink-0">
          <svg
            className="w-5 h-5 text-red-500"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
          </svg>
        </div>

        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder="Paste YouTube link here..."
          autoFocus
          spellCheck={false}
          className="flex-1 py-4 text-base text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 bg-transparent outline-none min-w-0"
        />

        {url && (
          <button
            type="button"
            onClick={() => {
              setUrl("");
              setError(null);
            }}
            className="px-3 text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="m-1.5 px-6 py-3 text-sm font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-xl hover:bg-zinc-700 dark:hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              Loading...
            </>
          ) : (
            "Transcribe"
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-1">
          <svg
            className="w-3.5 h-3.5 text-red-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        </div>
      )}

      <p className="text-xs text-zinc-400 dark:text-zinc-600 text-center">
        Works with youtube.com/watch · youtu.be · shorts · embed links
      </p>
    </form>
  );
}
