'use client';

import { useEffect } from 'react';

const legacyTargets: Record<string, string> = {
  '#holder-map': '/citizen/holders#holder-map',
  '#top-holders': '/citizen/holders#top-holders',
};

export default function CitizenLegacyHashRedirect() {
  useEffect(() => {
    const target = legacyTargets[window.location.hash];
    if (target) window.location.replace(target);
  }, []);

  return null;
}
