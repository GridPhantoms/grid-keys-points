'use client';

import { useEffect, useState } from 'react';

type MarketResponse = {
  ethUsd?: number | null;
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
  ethUsd: number | null;
  s1FloorEth: number | null;
  s1EliteFloorEth: number | null;
  s2FloorEth: number | null;
};

const emptyReferences: MarketReferences = {
  bytesPriceUsd: null,
  bytesMarketCapUsd: null,
  ethUsd: null,
  s1FloorEth: null,
  s1EliteFloorEth: null,
  s2FloorEth: null,
};

const finiteValue = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const availableValue = (metric: { value?: number | null; availability?: string } | undefined) => metric?.availability === 'available' ? finiteValue(metric.value) : null;
const formatPrice = (value: number | null) => value == null ? '—' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 3, maximumFractionDigits: 3 });
const formatMarketCap = (value: number | null) => value == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(value);
const formatEth = (value: number | null) => value == null ? '—' : `${value.toLocaleString('en-US', { maximumFractionDigits: 3 })} Ξ`;
const formatFloorUsd = (floorEth: number | null, ethUsd: number | null) => floorEth == null || ethUsd == null ? null : `≈ $${Math.round(floorEth * ethUsd).toLocaleString('en-US')}`;
const formatFloorRatio = (s1Floor: number | null, s2Floor: number | null) => s1Floor == null || s2Floor == null || s2Floor <= 0 ? '—' : `${(s1Floor / s2Floor).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`;

type CitizenOverviewGlanceProps = {
  s1Owners: number;
  s1HolderRatio: number;
  s2Owners: number;
  s2HolderRatio: number;
};

export default function CitizenOverviewGlance({ s1Owners, s1HolderRatio, s2Owners, s2HolderRatio }: CitizenOverviewGlanceProps) {
  const [references, setReferences] = useState<MarketReferences>(emptyReferences);

  useEffect(() => {
    const controller = new AbortController();

    void fetch('/api/citizen-terminal/market', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Market references unavailable');
        const payload = await response.json() as MarketResponse;
        const floor = (key: string) => finiteValue(payload.collections?.find((collection) => collection.key === key)?.floorEth);
        setReferences((current) => ({
          ...current,
          ethUsd: finiteValue(payload.ethUsd),
          s1FloorEth: floor('s1-citizens'),
          s1EliteFloorEth: floor('s1-elite'),
          s2FloorEth: floor('s2-citizens'),
        }));
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
    { label: 'S1 OWNERS', value: s1Owners.toLocaleString(), detail: `${s1HolderRatio.toFixed(1)}% HOLDER RATIO` },
    { label: 'S2 OWNERS', value: s2Owners.toLocaleString(), detail: `${s2HolderRatio.toFixed(1)}% HOLDER RATIO` },
    { label: '$BYTES SPOT', value: formatPrice(references.bytesPriceUsd) },
    { label: '$BYTES MCAP*', value: formatMarketCap(references.bytesMarketCapUsd) },
    { label: 'S1 FLOOR', value: formatEth(references.s1FloorEth), detail: formatFloorUsd(references.s1FloorEth, references.ethUsd) },
    { label: 'S1 ELITE FLOOR', value: formatEth(references.s1EliteFloorEth), detail: formatFloorUsd(references.s1EliteFloorEth, references.ethUsd) },
    { label: 'S2 FLOOR', value: formatEth(references.s2FloorEth), detail: formatFloorUsd(references.s2FloorEth, references.ethUsd) },
    { label: 'S1 / S2 FLOOR', value: formatFloorRatio(references.s1FloorEth, references.s2FloorEth) },
  ];

  return <section className="ct-overview-glance" aria-label="Citizen Interlink at a glance">
    <header><span>INTERLINK AT A GLANCE</span><small>OWNERSHIP <b>•</b> $BYTES <b>•</b> FLOORS</small></header>
    <div aria-live="polite">{metrics.map(({ label, value, detail }) => <article key={label}>
      <span>{label}</span><strong>{value}</strong>{detail ? <span className="ct-overview-glance-ratio">{detail}</span> : null}
    </article>)}</div>
    <p className="ct-overview-glance-note">MCAP* = CANONICAL ETHEREUM SUPPLY × CURRENT $BYTES/USD SPOT</p>
  </section>;
}
