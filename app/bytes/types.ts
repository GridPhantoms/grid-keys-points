export type MetricClassification = 'observed' | 'calculated' | 'projected' | 'reference';
export type MetricAvailability = 'available' | 'partial' | 'unavailable';

export type EmissionPools = {
  S1: number | null;
  S2: number | null;
  BYTES: number | null;
  LP: number | null;
  total: number | null;
};

type MetricRecordMetadata = {
  unit: string;
  classification: MetricClassification;
  source: string;
  asOf: string;
  formula?: string;
  assumptions?: string[];
  reason?: string;
  unavailablePools?: string[];
};

export type MetricRecord<T = number> = MetricRecordMetadata & (
  | { availability: 'available'; value: Exclude<T, null> }
  | { availability: 'partial'; value: T }
  | { availability: 'unavailable'; value: null }
);

export type BytesMetricsResponse = {
  schemaVersion: 1;
  generatedAt: string;
  sourceBlock: number;
  freshnessPolicy: {
    freshForSeconds: number;
    staleWhileRevalidateSeconds: number;
    staleIfErrorSeconds: number;
  };
  status: 'fresh' | 'partial';
  metrics: {
    currentConfiguredEmissions: MetricRecord<EmissionPools>;
    currentModeledRate: MetricRecord<EmissionPools>;
    annualizedConfiguredIssuance: MetricRecord;
    configuredVsTheoretical: MetricRecord;
    theoreticalWeek: MetricRecord;
    ethBytes2Supply: MetricRecord;
    bytesHeldByStakingContract: MetricRecord;
    pendingUnclaimedRewards: MetricRecord;
    [key: string]: MetricRecord<unknown> | undefined;
  };
  projections: {
    steadyParticipationRemainingIssuance: MetricRecord;
    maximumParticipationRemainingIssuance: MetricRecord;
    [key: string]: MetricRecord<unknown> | undefined;
  };
  provenance: Record<string, unknown>;
  warnings: string[];
};

export type EmissionsHistoryRow = {
  date: string;
  S1: number;
  S2: number;
  BYTES: number;
  LP: number;
  total: number;
};

export type EmissionsHistory = {
  schemaVersion: 1;
  generatedAt: string;
  sourceBlock: number | null;
  start?: string;
  end?: string;
  methodology: {
    classification?: MetricClassification;
    source: string;
    contract?: string;
    normalization?: string;
    [key: string]: unknown;
  };
  rows: EmissionsHistoryRow[];
};
