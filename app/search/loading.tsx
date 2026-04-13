import { Topbar } from '@/components/topbar';

export default function Loading() {
  return (
    <>
      <Topbar />
      <div className="pt-24 pb-16 px-4 md:px-8 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-48 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-md bg-white/5 aspect-video" />
          ))}
        </div>
      </div>
    </>
  );
}
