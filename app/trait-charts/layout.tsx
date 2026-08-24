import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Trait Charts | Grid Phantoms',
  description: 'Genesis and Exodus Key trait point charts with complete accessible point tables.',
};

export default function TraitChartsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
