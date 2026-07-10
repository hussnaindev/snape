const SKELETON_CARDS = Array.from({ length: 12 }, (_, i) => `card-${i}`);
const SKELETON_ROWS = Array.from({ length: 3 }, (_, i) => `row-${i}`);
const SKELETON_COLS = Array.from({ length: 6 }, (_, i) => `col-${i}`);

export default function Loading() {
  return (
    <>
      <div className="pt-20 animate-pulse">
        <section>
          <div className="px-4 md:px-8 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="h-px flex-1 bg-white/10" />
              <span className="h-4 bg-white/10 rounded w-36" />
              <span className="h-px flex-1 bg-white/10" />
            </div>
          </div>
        </section>
        {/* Mobile */}
        <div className="grid grid-cols-2 gap-3 px-4 sm:hidden">
          {SKELETON_CARDS.map((key) => (
            <div
              key={key}
              className="aspect-[2/3] rounded-2xl sm:rounded-[28px] bg-white/5 ring-1 sm:ring-2 ring-white/25 shadow-[0_8px_24px_rgba(255,255,255,0.08),_0_2px_6px_rgba(255,255,255,0.05)]"
            />
          ))}
        </div>
        {/* Desktop */}
        <div className="hidden sm:block">
          {SKELETON_ROWS.map((rowKey) => (
            <section key={rowKey}>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(165px,210px))] justify-center gap-3 px-4 md:px-8">
                {SKELETON_COLS.map((colKey) => (
                  <div
                    key={colKey}
                    className="aspect-[2/3] rounded-2xl sm:rounded-[28px] bg-white/5 ring-1 sm:ring-2 ring-white/25 shadow-[0_8px_24px_rgba(255,255,255,0.08),_0_2px_6px_rgba(255,255,255,0.05)]"
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
