import { Topbar } from '@/components/topbar';

export default function Loading() {
  return (
    <>
      <Topbar />
      <div className="animate-pulse">
        {/* Backdrop skeleton */}
        <div className="w-full h-[55vw] max-h-[480px] bg-white/5" />

        {/* Info block */}
        <div className="px-4 md:px-8 -mt-36 md:-mt-60 relative z-10">
          <div className="flex gap-4 md:gap-8 h-36 md:h-60">
            {/* Poster */}
            <div className="flex-none w-24 md:w-40 rounded bg-white/10 aspect-[2/3]" />

            {/* Details */}
            <div className="flex-1 min-w-0 flex flex-col justify-end gap-2 pb-1">
              <div className="h-6 md:h-9 bg-white/10 rounded w-2/3" />
              <div className="h-3 bg-white/10 rounded w-1/4" />
              <div className="flex gap-2 mt-1">
                <div className="h-5 bg-white/10 rounded-full w-16" />
                <div className="h-5 bg-white/10 rounded-full w-16" />
              </div>
              <div className="h-9 bg-white/10 rounded-lg w-28 mt-auto" />
            </div>
          </div>

          {/* Synopsis */}
          <div className="mt-5 md:mt-8 max-w-2xl space-y-2">
            <div className="h-3 bg-white/10 rounded w-full" />
            <div className="h-3 bg-white/10 rounded w-5/6" />
            <div className="h-3 bg-white/10 rounded w-4/6" />
          </div>
        </div>

        {/* Cast rail */}
        <div className="mt-10 px-4 md:px-8">
          <div className="h-px bg-white/10 mb-4" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-none w-24">
                <div className="aspect-[2/3] rounded bg-white/10 mb-2" />
                <div className="h-2.5 bg-white/10 rounded w-4/5 mb-1" />
                <div className="h-2 bg-white/10 rounded w-3/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
