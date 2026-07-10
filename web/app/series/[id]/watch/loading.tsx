import { SnakeLoader } from '@/components/ui/snake-loader';

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <SnakeLoader size={56} />
    </div>
  );
}
