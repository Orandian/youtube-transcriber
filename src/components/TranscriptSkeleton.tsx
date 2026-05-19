export function TranscriptSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row h-screen w-full overflow-hidden">
      {/* Video skeleton */}
      <div className="w-full lg:w-1/2 bg-zinc-900 flex items-center justify-center shrink-0">
        <div
          className="w-full"
          style={{ paddingBottom: "56.25%", position: "relative" }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/10 animate-pulse flex items-center justify-center">
              <div className="w-0 h-0 border-y-8 border-y-transparent border-l-[14px] border-l-white/30 ml-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Transcript skeleton */}
      <div className="w-full lg:w-1/2 flex flex-col overflow-hidden border-l border-zinc-100">
        <div className="px-4 py-2 border-b border-zinc-100 flex items-center justify-between">
          <div className="h-3 w-20 bg-zinc-200 rounded animate-pulse" />
          <div className="h-3 w-12 bg-zinc-100 rounded animate-pulse" />
        </div>
        <div className="flex-1 divide-y divide-zinc-50">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex gap-3">
              <div className="h-3 w-8 bg-zinc-100 rounded animate-pulse shrink-0 mt-1" />
              <div className="flex flex-col gap-2 flex-1">
                <div
                  className="h-3 bg-zinc-100 rounded animate-pulse"
                  style={{ width: `${60 + (i % 4) * 10}%` }}
                />
                {i % 3 === 0 && (
                  <div className="h-3 bg-zinc-100 rounded animate-pulse w-1/2" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
