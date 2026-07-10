// TV Channels page — disabled. Uncomment block below to re-enable.
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TV Channels',
};

export default function ChannelsPage() {
  notFound();
}

/*
import { ChannelsView } from '@/app/channels/channels-view';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TV Channels',
};

export default function ChannelsPage() {
  return <ChannelsView />;
}
*/
