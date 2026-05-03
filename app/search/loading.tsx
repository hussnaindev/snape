import { Topbar } from '@/components/topbar';

export default function Loading() {
  return (
    <>
      <Topbar />
      <div className="pt-24 pb-16 px-4 md:px-8 animate-pulse">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="h-9 bg-white/10 rounded-full w-40" />
          <div className="h-3 bg-white/5 rounded w-24" />
          <div className="h-8 bg-white/10 rounded-lg w-56 p-1" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-md bg-white/5 aspect-video" />
          ))}
        </div>
      </div>
    </>
  );
}
