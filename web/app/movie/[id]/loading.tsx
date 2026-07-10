export default function Loading() {
  return (
    <>
      <div className="animate-pulse">
        {/* Backdrop skeleton */}
        <div className="relative overflow-hidden bg-black h-[calc(30vh+4rem)] md:h-[calc(55vh+9rem)] min-h-[200px] md:min-h-[320px]">
          <div className="absolute inset-0 bg-white/5" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent pointer-events-none" />
        </div>

        {/* Info block */}
        <div className="px-4 md:px-8 relative z-10 -mt-36 md:-mt-60">
          <div className="flex gap-4 md:gap-8 items-stretch h-36 md:h-60">
            {/* Poster */}
            <div className="flex-none w-24 md:w-40 lg:w-48 xl:w-56">
              <div className="relative aspect-[2/3] w-full h-full rounded overflow-hidden shadow-2xl bg-white/10" />
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div className="min-w-0">
                {/* Title */}
                <div className="h-6 md:h-9 bg-white/10 rounded w-2/3" />
                {/* Tagline (hidden on mobile) */}
                <div className="hidden md:block mt-1 h-3 bg-white/10 rounded w-1/3" />
                {/* Metadata: year · runtime · rating */}
                <div className="flex items-center gap-1 md:gap-2 mt-1">
                  <div className="h-3 md:h-3.5 bg-white/10 rounded w-16" />
                  <div className="h-3 md:h-3.5 bg-white/10 rounded w-12" />
                  <div className="h-3 md:h-3.5 bg-white/10 rounded w-14" />
                </div>
                {/* Genres (up to 3 pills) */}
                <div className="flex flex-nowrap items-center gap-1 md:gap-2 mt-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-5 md:h-6 bg-white/10 rounded-full w-16" />
                  ))}
                </div>
                {/* WatchProvidersRow reserved space */}
                <div className="mt-2 h-8 md:h-16 shrink-0" />
              </div>
              {/* Watch buttons + watchlist */}
              <div className="pt-2 flex items-center gap-2 shrink-0">
                {/* Mobile watch button */}
                <div className="flex-1 h-10 bg-white/10 rounded-full min-w-36 md:hidden" />
                {/* Desktop watch button */}
                <div className="hidden md:inline-flex h-10 md:h-12 bg-white/10 rounded-full min-w-36" />
                {/* Mobile watchlist */}
                <div className="size-10 bg-white/10 rounded-full md:hidden" />
                {/* Desktop watchlist */}
                <div className="hidden md:inline-flex size-10 md:size-12 bg-white/10 rounded-full" />
              </div>
            </div>
          </div>

          {/* Synopsis */}
          <div className="mt-5 md:mt-8 max-w-2xl xl:max-w-3xl">
            <div className="space-y-1">
              <div className="h-4 md:h-5 bg-white/10 rounded w-full" />
              <div className="h-4 md:h-5 bg-white/10 rounded w-5/6" />
              <div className="h-4 md:h-5 bg-white/10 rounded w-4/6" />
            </div>
            <div className="mt-1 h-3 md:h-3.5 bg-white/10 rounded w-14" />
          </div>
        </div>

        {/* Cast rail */}
        <section className="mt-10">
          <div className="px-4 md:px-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="h-px flex-1 bg-white/10" />
              <span className="h-3 bg-white/10 rounded w-14" />
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory overscroll-x-contain py-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex-none w-24 sm:w-28 group snap-start">
                  <div className="aspect-square rounded-full bg-white/10 mb-2 ring-2 ring-white/10" />
                  <div className="bg-gradient-to-t from-black/85 to-black/50 py-1.5 rounded-md px-2 space-y-1">
                    <div className="h-2.5 bg-white/10 rounded w-4/5 mx-auto" />
                    <div className="h-2 bg-white/10 rounded w-3/5 mx-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* More Like This */}
        <section className="mt-10 mb-16">
          <div className="px-4 md:px-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="h-px flex-1 bg-white/10" />
              <span className="h-3 bg-white/10 rounded w-20" />
              <span className="h-px flex-1 bg-white/10" />
            </div>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-2 px-4 md:px-8 py-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-none w-[130px] sm:w-[170px] md:w-[180px] lg:w-[190px] xl:w-[210px] 2xl:w-[240px] 3xl:w-[260px]"
                >
                  <div className="aspect-[2/3] rounded bg-white/10 mb-2" />
                  <div className="h-2.5 bg-white/10 rounded w-4/5 mb-1" />
                  <div className="h-2 bg-white/10 rounded w-3/5" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
