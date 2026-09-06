import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Trait Intelligence Archive | Grid Phantoms',
  description: 'Grid Clearance, the current Hazard Support schedule, tactical trait intelligence, and complete Genesis and Exodus point charts.',
};

export default function TraitChartsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
