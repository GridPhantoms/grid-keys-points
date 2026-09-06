export type GridClearanceLevel = {
  level: 0 | 1 | 2 | 3 | 4;
  name: string;
  minimumPoints: number;
  maximumPoints: number | null;
  hazardSupport: number;
};

export const GRID_CLEARANCE_LEVELS: readonly GridClearanceLevel[] = [
  { level: 0, name: 'Perimeter Access', minimumPoints: 0, maximumPoints: 4_999, hazardSupport: 0 },
  { level: 1, name: 'Restricted Network Access', minimumPoints: 5_000, maximumPoints: 9_999, hazardSupport: 3 },
  { level: 2, name: 'Tactical Sector Access', minimumPoints: 10_000, maximumPoints: 24_999, hazardSupport: 6 },
  { level: 3, name: 'Syndicate Blacksite Access', minimumPoints: 25_000, maximumPoints: 99_999, hazardSupport: 10 },
  { level: 4, name: 'Core Infiltration Clearance', minimumPoints: 100_000, maximumPoints: null, hazardSupport: 15 },
] as const;

export type GridClearance = GridClearanceLevel & {
  nextLevel: GridClearanceLevel | null;
  pointsToNextLevel: number | null;
  progressPercent: number;
};

export function getGridClearance(rawPoints: number): GridClearance {
  const points = Number.isFinite(rawPoints) ? Math.max(0, Math.floor(rawPoints)) : 0;
  const active = [...GRID_CLEARANCE_LEVELS]
    .reverse()
    .find((candidate) => points >= candidate.minimumPoints) ?? GRID_CLEARANCE_LEVELS[0];
  const nextLevel = GRID_CLEARANCE_LEVELS.find((candidate) => candidate.level === active.level + 1) ?? null;
  const pointsToNextLevel = nextLevel ? Math.max(0, nextLevel.minimumPoints - points) : null;
  const progressPercent = nextLevel
    ? Math.min(100, Math.max(0, ((points - active.minimumPoints) / (nextLevel.minimumPoints - active.minimumPoints)) * 100))
    : 100;

  return { ...active, nextLevel, pointsToNextLevel, progressPercent };
}
