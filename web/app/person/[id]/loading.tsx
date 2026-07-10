const KNOWN_FOR_SKELETONS = Array.from({ length: 6 }, (_, i) => `known-${i}`);
const FILMOGRAPHY_MOBILE = Array.from({ length: 4 }, (_, i) => `fm-${i}`);
const FILMOGRAPHY_DESKTOP = Array.from({ length: 10 }, (_, i) => `fd-${i}`);

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
        <div className="px-4 md:px-8 -mt-36 md:-mt-60 relative z-10">
          <section>
            <div className="flex gap-4 md:gap-8 h-36 md:h-60">
              {/* Photo */}
              <div className="flex-none w-24 md:w-40 rounded overflow-hidden shadow-2xl">
                <div className="relative aspect-[2/3] bg-white/10" />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-end">
                <div className="h-6 md:h-9 bg-white/10 rounded w-2/5" />
                <div className="h-3 md:h-3.5 bg-white/10 rounded w-1/5 mt-0.5" />
                <div className="flex items-center gap-1 md:gap-2 mt-0.5 md:mt-2">
                  <div className="h-3 bg-white/10 rounded w-28" />
                  <div className="h-3 bg-white/10 rounded w-20" />
                </div>
              </div>
            </div>

            {/* Biography */}
            <div className="mt-5 md:mt-8 max-w-2xl">
              <div className="space-y-1">
                <div className="h-4 md:h-5 bg-white/10 rounded w-full" />
                <div className="h-4 md:h-5 bg-white/10 rounded w-5/6" />
                <div className="h-4 md:h-5 bg-white/10 rounded w-4/6" />
                <div className="h-4 md:h-5 bg-white/10 rounded w-full" />
                <div className="h-4 md:h-5 bg-white/10 rounded w-3/4" />
              </div>
              <div className="mt-1 h-3 md:h-3.5 bg-white/10 rounded w-14" />
            </div>
          </section>
        </div>

        {/* Known For */}
        <section className="px-4 md:px-8 mt-10 mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-px flex-1 bg-white/10" />
            <span className="h-3 bg-white/10 rounded w-16" />
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar py-12 px-1">
            {KNOWN_FOR_SKELETONS.map((key) => (
              <div
                key={key}
                className="flex-none w-[130px] sm:w-[170px] md:w-[180px] lg:w-[190px] xl:w-[210px] 2xl:w-[240px]"
              >
                <div className="aspect-[2/3] rounded bg-white/10 mb-2" />
                <div className="h-2.5 bg-white/10 rounded w-4/5 mb-1" />
                <div className="h-2 bg-white/10 rounded w-3/5" />
              </div>
            ))}
          </div>
        </section>

        {/* Filmography */}
        <section className="pb-16">
          <div className="px-4 md:px-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="h-px flex-1 bg-white/10" />
              <span className="h-3 bg-white/10 rounded w-20" />
              <span className="h-px flex-1 bg-white/10" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 px-4 py-8 sm:hidden">
            {FILMOGRAPHY_MOBILE.map((key) => (
              <div key={key} className="rounded-md bg-white/5 aspect-[2/3]" />
            ))}
          </div>
          <div className="hidden sm:block">
            <div className="px-4 md:px-8">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(165px,210px))] justify-center gap-3 py-8">
                {FILMOGRAPHY_DESKTOP.map((key) => (
                  <div key={key} className="rounded-md bg-white/5 aspect-[2/3]" />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
