import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Mint Progress | Grid Phantoms',
  description: 'Verified Genesis and Exodus Key mint progress for the Grid Phantoms collection.',
};

export default function MintProgressLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
