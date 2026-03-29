import { SnakeLoader } from '@/components/ui/snake-loader';
import { APP_NAME } from '@/lib/config';

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6">
      <SnakeLoader size={72} />
      <span className="font-syne text-white/30 text-xs tracking-[0.28em] uppercase">
        {APP_NAME}
      </span>
    </div>
  );
}
