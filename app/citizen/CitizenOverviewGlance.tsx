'use client';

import { useEffect, useState } from 'react';

type MarketResponse = {
  collections?: Array<{ key?: string; floorEth?: number | null }>;
};

type BytesResponse = {
  metrics?: {
    bytesPriceUsd?: { value?: number | null; availability?: string };
    totalSupplyValuationUsd?: { value?: number | null; availability?: string };
  };
};

type MarketReferences = {
  bytesPriceUsd: number | null;
  bytesMarketCapUsd: number | null;
  s1FloorEth: number | null;
  s1EliteFloorEth: number | null;
  s2FloorEth: number | null;
};

const emptyReferences: MarketReferences = {
  bytesPriceUsd: null,
  bytesMarketCapUsd: null,
  s1FloorEth: null,
  s1EliteFloorEth: null,
  s2FloorEth: null,
};

const finiteValue = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const availableValue = (metric: { value?: number | null; availability?: string } | undefined) => metric?.availability === 'available' ? finiteValue(metric.value) : null;
const formatPrice = (value: number | null) => value == null ? '—' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });
const formatMarketCap = (value: number | null) => value == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(value);
const formatEth = (value: number | null) => value == null ? '—' : `${value.toLocaleString('en-US', { maximumFractionDigits: 4 })} Ξ`;

export default function CitizenOverviewGlance({ s1Owners, s2Owners }: { s1Owners: number; s2Owners: number }) {
  const [references, setReferences] = useState<MarketReferences>(emptyReferences);

  useEffect(() => {
    const controller = new AbortController();

    void fetch('/api/citizen-terminal/market', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Market references unavailable');
        const payload = await response.json() as MarketResponse;
        const floor = (key: string) => finiteValue(payload.collections?.find((collection) => collection.key === key)?.floorEth);
        setReferences((current) => ({ ...current, s1FloorEth: floor('s1-citizens'), s1EliteFloorEth: floor('s1-elite'), s2FloorEth: floor('s2-citizens') }));
      })
      .catch(() => undefined);

    void fetch('/api/bytes-metrics', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('BYTES references unavailable');
        const payload = await response.json() as BytesResponse;
        setReferences((current) => ({
          ...current,
          bytesPriceUsd: availableValue(payload.metrics?.bytesPriceUsd),
          bytesMarketCapUsd: availableValue(payload.metrics?.totalSupplyValuationUsd),
        }));
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  const metrics = [
    ['S1 OWNERS', s1Owners.toLocaleString()],
    ['S2 OWNERS', s2Owners.toLocaleString()],
    ['$BYTES SPOT', formatPrice(references.bytesPriceUsd)],
    ['$BYTES MCAP*', formatMarketCap(references.bytesMarketCapUsd)],
    ['S1 FLOOR', formatEth(references.s1FloorEth)],
    ['S1 ELITE FLOOR', formatEth(references.s1EliteFloorEth)],
    ['S2 FLOOR', formatEth(references.s2FloorEth)],
  ] as const;

  return <section className="ct-overview-glance" aria-label="Citizen Interlink at a glance">
    <header><span>INTERLINK AT A GLANCE</span><small>OWNERSHIP + MARKET REFERENCES</small></header>
    <div aria-live="polite">{metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <p className="ct-overview-glance-note">MCAP* = CANONICAL ETHEREUM SUPPLY × CURRENT $BYTES/USD SPOT</p>
  </section>;
}
