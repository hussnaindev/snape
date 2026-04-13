import { Topbar } from '@/components/topbar';

export default function Loading() {
  return (
    <>
      <Topbar />
      <div className="pt-20 animate-pulse">
        <div className="px-4 md:px-8 mb-6">
          <div className="h-px bg-white/10 mb-2" />
          <div className="h-4 bg-white/10 rounded w-36" />
        </div>
        <div className="px-4 md:px-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="rounded-md bg-white/5 aspect-video" />
          ))}
        </div>
      </div>
    </>
  );
}
