'use client';

import { useId, useMemo } from 'react';
import { sampleMinMax } from '../../lib/bytes-client-data.mjs';
import type { EmissionsHistoryRow } from './types';

const EPOCH_MS = Date.parse('2023-06-15T00:00:00Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const THEORETICAL_RESERVOIR = 5_875;
const MAX_POINTS = 180;
const GENESIS_HALF_LEVELS = [
  { level: '1st Half-Level', value: 5_500 },
  { level: '2nd Half-Level', value: 2_750 },
  { level: '3rd Half-Level', value: 1_375 },
  { level: '4th Half-Level', value: 687.5 },
] as const;

function compact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 1_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1_000 ? 1 : 0,
  }).format(value);
}

function dateLabel(value: string, includeYear = true) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    ...(includeYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function EmissionsChart({ rows }: { rows: EmissionsHistoryRow[] }) {
  const gradientId = useId().replaceAll(':', '');
  const chart = useMemo(() => {
    if (rows.length < 2) return null;
    const sourceRows = [...rows];
    const sampled = sampleMinMax(sourceRows, MAX_POINTS, (row: EmissionsHistoryRow) => row.total);
    const startMs = Date.parse(`${sourceRows[0].date}T00:00:00Z`);
    const endMs = Date.parse(`${sourceRows.at(-1)?.date}T00:00:00Z`);
    const theoretical = sampled.map((row) => {
      const time = Date.parse(`${row.date}T00:00:00Z`);
      if (time < EPOCH_MS) return null;
      const week = Math.floor((time - EPOCH_MS) / WEEK_MS);
      return THEORETICAL_RESERVOIR * 2 ** (-week / 52);
    });
    const yMaximum = Math.max(
      ...sourceRows.map((row) => row.total),
      ...theoretical.filter((value): value is number => value !== null),
      1,
    );
    const niceMaximum = Math.ceil(yMaximum / 1_000) * 1_000;
    const left = 62;
    const right = 740;
    const top = 22;
    const bottom = 280;
    const x = (date: string) => left + ((Date.parse(`${date}T00:00:00Z`) - startMs) / Math.max(1, endMs - startMs)) * (right - left);
    const y = (value: number) => bottom - (value / niceMaximum) * (bottom - top);
    const actualPoints = sampled.map((row) => `${x(row.date).toFixed(1)},${y(row.total).toFixed(1)}`).join(' ');
    const modeledPoints = sampled
      .map((row, index) => theoretical[index] === null ? null : `${x(row.date).toFixed(1)},${y(theoretical[index] as number).toFixed(1)}`)
      .filter(Boolean)
      .join(' ');
    const latest = sourceRows.at(-1)!;
    const yTicks = Array.from({ length: 5 }, (_, index) => niceMaximum * (1 - index / 4));
    const dateTicks = Array.from({ length: 4 }, (_, index) => {
      const rowIndex = Math.round((sourceRows.length - 1) * (index / 3));
      return sourceRows[rowIndex];
    });
    const genesisMilestones = GENESIS_HALF_LEVELS.filter(({ value }) => value <= niceMaximum);
    return { actualPoints, modeledPoints, latest, niceMaximum, yTicks, dateTicks, genesisMilestones, x, y, left, right, top, bottom };
  }, [rows]);

  if (!chart) {
    return (
      <div className="bytes-chart-placeholder" role="status" aria-live="polite">
        At least two validated historical samples are required to draw the emissions chart.
      </div>
    );
  }

  const latestX = chart.x(chart.latest.date);
  const latestY = chart.y(chart.latest.total);

  return (
    <div className="bytes-chart-wrap">
      <svg className="bytes-chart" viewBox="0 0 760 330" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby={`${gradientId}-title ${gradientId}-desc`}>
        <title id={`${gradientId}-title`}>Reconstructed Configured and Modeled BYTES Daily Emissions</title>
        <desc id={`${gradientId}-desc`}>Calculated configured history reconstructed from observed inputs from {rows[0].date} through {chart.latest.date}, compared with a modeled weekly emissions-decay curve based on the historical steady scenario. Horizontal references mark half-level milestones versus Genesis at 5,500, 2,750, 1,375, and 687.5 BYTES per day when they are within the chart domain.</desc>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#28d7f2" stopOpacity=".18" />
            <stop offset="1" stopColor="#28d7f2" stopOpacity="0" />
          </linearGradient>
        </defs>
        {chart.yTicks.map((tick) => {
          const y = chart.y(tick);
          return (
            <g key={tick}>
              {!chart.genesisMilestones.some((milestone) => milestone.value === tick) && <line x1={chart.left} x2={chart.right} y1={y} y2={y} className="bytes-chart-grid" />}
              <text x={chart.left - 10} y={y + 4} textAnchor="end" className="bytes-chart-axis">{compact(tick)}</text>
            </g>
          );
        })}
        {chart.dateTicks.map((row, index) => (
          <text key={`${row.date}-${index}`} x={chart.x(row.date)} y="310" textAnchor={index === 0 ? 'start' : index === chart.dateTicks.length - 1 ? 'end' : 'middle'} className="bytes-chart-axis">
            {index === chart.dateTicks.length - 1 ? 'LATEST' : dateLabel(row.date)}
          </text>
        ))}
        {chart.genesisMilestones.map((milestone, index) => {
          const y = chart.y(milestone.value);
          const isLowestMilestone = index === chart.genesisMilestones.length - 1;
          const labelY = isLowestMilestone ? Math.min(chart.bottom - 3, y + 14) : y - 6;
          return (
            <g key={milestone.value} className={index % 2 === 0 ? 'bytes-chart-milestone is-violet' : 'bytes-chart-milestone is-gray'}>
              <line x1={chart.left} x2={chart.right} y1={y} y2={y} />
              <text x={chart.right - 8} y={labelY} textAnchor="end">Genesis {milestone.level} · {milestone.value.toLocaleString('en-US')}</text>
            </g>
          );
        })}
        <polygon points={`${chart.left},${chart.bottom} ${chart.actualPoints} ${chart.right},${chart.bottom}`} fill={`url(#${gradientId})`} />
        <polyline points={chart.actualPoints} fill="none" className="bytes-chart-history" />
        <polyline points={chart.modeledPoints} fill="none" className="bytes-chart-modeled" />
        <circle cx={latestX} cy={latestY} r="4.5" fill="#28d7f2" />
        <circle cx={latestX} cy={latestY} r="10" fill="none" stroke="#28d7f2" opacity=".28" />
      </svg>
      <div className="bytes-chart-latest" aria-label="Latest chart values">
        <span><b>Latest Sample</b> {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${chart.latest.date}T00:00:00Z`))}</span>
      </div>
      <div className="bytes-chart-legend" aria-label="Chart legend">
        <span><i className="legend-history" aria-hidden="true" />Reconstructed Configured History · Calculated from Observed Inputs</span>
        <span><i className="legend-modeled" aria-hidden="true" />Modeled Weekly Emissions Decay</span>
        <span><i className="legend-milestone" aria-hidden="true" />Half-Level Milestones vs. Genesis · 5,500 / 2,750 / 1,375 / 687.5 BYTES/day</span>
      </div>
    </div>
  );
}
