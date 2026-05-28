import { ChannelsView } from '@/app/channels/channels-view';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TV Channels',
};

export default function ChannelsPage() {
  return <ChannelsView />;
}
