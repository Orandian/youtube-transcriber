export const runtime = "edge";

import { UrlForm } from "@/components/UrlForm";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col transition-colors">
      {/* Header */}
      <header className="border-b border-zinc-100 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            YouTube Transcriber
          </span>
        </div>
        <ThemeToggle />
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <div className="w-full max-w-2xl flex flex-col items-center gap-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight leading-tight">
              Get any YouTube
              <br />
              transcript instantly
            </h1>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-md leading-relaxed">
              Paste a link. Read, follow along, and download the full transcript
              — no sign-up needed.
            </p>
          </div>

          <UrlForm />
        </div>
      </main>

      <footer className="py-5 text-center">
        <p className="text-sm text-zinc-400 dark:text-zinc-600">
          Made with <span className="text-red-500">♥</span> by{" "}
          <a
            href="https://yannainghtwe.xilanova.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2 transition-colors"
          >
            Yan Naing Htwe
          </a>
        </p>
      </footer>
    </div>
  );
}
