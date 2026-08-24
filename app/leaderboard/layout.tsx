import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Leaderboards | Grid Phantoms',
  description: 'Grid Phantoms Keyholder rankings and historical Lifetime Phantom Rewards leaderboard.',
};

export default function LeaderboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
