import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Raffle Tracker | Grid Phantoms',
  description: 'Live Grid Phantoms raffle progress, eligible Exodus Key mints, entrant tickets, and transparent odds.',
};

export default function RaffleLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
