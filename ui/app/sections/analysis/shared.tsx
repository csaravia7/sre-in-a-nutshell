import React from 'react';
import type { Locale } from '../../i18n/translations';

const palette = {
  success: '#1f9d61',
  warning: '#c07400',
  critical: '#cb3a31',
  neutral: '#57667c',
  border: '#dfe7f4',
};

// Per-group record returned by the analysis queries.
// Field names are unverified against the tenant — confirm in a Notebook (see CLAUDE.md §DQL).
export type MetricRecord = {
  name: string;
  cluster?: string;
  namespace?: string;
  entity_id?: string;
  workload?: string;
  workload_type?: string;
  availability_pct: number;
  error_rate_pct: number;
  total_count: number;
  p90_response_time: number; // microseconds — 90th-percentile latency
  service_count?: number;   // only present in namespace-level records
};

export type Kpis = {
  availability: number | null;
  errorRate: number | null;
  throughput: number | null;
  latency: number | null; // milliseconds
};

export function toKpis(record: MetricRecord | undefined): Kpis {
  if (record === undefined) {
    return { availability: null, errorRate: null, throughput: null, latency: null };
  }
  return {
    availability: record.availability_pct,
    errorRate: record.error_rate_pct,
    throughput: record.total_count,
    latency: record.p90_response_time / 1000,
  };
}

export type TimeseriesRecord = {
  name: string;
  workload?: string;
  entity_id?: string;
  namespace?: string;
  cluster?: string;
  timeframe?: { start: string; end: string };
  total: (number | null)[];
  failures: (number | null)[];
  p50_latency: (number | null)[];
  p90_latency: (number | null)[];
  p99_latency: (number | null)[];
};

export {
  namespaceQuery as buildNamespaceQuery,
  serviceQuery as buildServiceQuery,
  heatmapQuery as buildHeatmapQuery,
  serviceTimeseriesQuery as buildTimeseriesQuery,
} from '../../queries/analysis';

// Four-step availability scale used by the heatmap. `none` means "no traffic that
// day", which is deliberately distinct from red — a silent service isn't a failing one.
export type AvailabilityBucket = 'green' | 'yellow' | 'orange' | 'red' | 'none';

export const AVAILABILITY_BUCKETS: readonly AvailabilityBucket[] = ['green', 'yellow', 'orange', 'red'];

// Lower bound (inclusive) of each bucket, in percent.
export const BUCKET_THRESHOLDS: Record<Exclude<AvailabilityBucket, 'none'>, number> = {
  green: 99.9,
  yellow: 99,
  orange: 95,
  red: 0,
};

const bucketColors: Record<AvailabilityBucket, string> = {
  green: palette.success,
  yellow: '#d6a10a',
  orange: '#dd6b20',
  red: palette.critical,
  none: 'transparent',
};

export function availabilityBucket(value: number | null): AvailabilityBucket {
  if (value === null || !isFinite(value)) return 'none';
  if (value >= BUCKET_THRESHOLDS.green) return 'green';
  if (value >= BUCKET_THRESHOLDS.yellow) return 'yellow';
  if (value >= BUCKET_THRESHOLDS.orange) return 'orange';
  return 'red';
}

export function bucketColor(bucket: AvailabilityBucket): string {
  return bucketColors[bucket];
}

// Compact number formatting (k, M, B, T…), locale-aware.
export function formatCompact(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

type Formatted = { text: string; color?: string };

export type HealthStatus = 'ideal' | 'good' | 'neutral' | 'warning' | 'critical';

export function availabilityStatus(value: number | null): HealthStatus {
  if (value === null) return 'neutral';
  if (value >= 99.9) return 'ideal';
  if (value >= 99) return 'good';
  if (value >= 95) return 'warning';
  return 'critical';
}

export function statusAccentColor(status: HealthStatus): string {
  switch (status) {
    case 'ideal':
    case 'good':
      return palette.success;
    case 'warning':
      return palette.warning;
    case 'critical':
      return palette.critical;
    default:
      return palette.border;
  }
}

export function availabilityFormat(value: number | null): Formatted {
  if (value === null) return { text: '—' };
  return { text: `${value.toFixed(2)}%`, color: statusAccentColor(availabilityStatus(value)) };
}

export function errorRateFormat(value: number | null): Formatted {
  if (value === null) return { text: '—' };
  const color = value <= 0.1 ? palette.success : value <= 1 ? palette.warning : palette.critical;
  return { text: `${value.toFixed(2)}%`, color };
}

export function throughputFormat(value: number | null, locale: Locale): Formatted {
  if (value === null) return { text: '—' };
  return { text: formatCompact(value, locale), color: palette.neutral };
}

export function latencyFormat(value: number | null): Formatted {
  if (value === null) return { text: '—' };
  const color = value < 100 ? palette.success : value < 500 ? palette.warning : palette.critical;
  return { text: `${value.toFixed(1)} ms`, color };
}

export function KpiCell({ formatted }: { formatted: Formatted }) {
  return <span style={{ color: formatted.color ?? 'var(--text)' }}>{formatted.text}</span>;
}

export function ReferenceDeltaCell({
  current,
  reference,
  goodDirection,
  formatValue,
}: {
  current: number | null;
  reference: number | null;
  goodDirection: 'up' | 'down';
  formatValue: (v: number) => string;
}) {
  if (reference === null) return <span style={{ color: palette.neutral }}>—</span>;

  const refDisplay = formatValue(reference);

  if (current === null || reference === 0) {
    return <span style={{ color: palette.neutral }}>{refDisplay}</span>;
  }

  const pct = ((current - reference) / Math.abs(reference)) * 100;
  const rounded = Number(pct.toFixed(1));
  const isUp = rounded > 0;
  const isGood = goodDirection === 'up' ? isUp : !isUp;
  const color = isGood ? palette.success : palette.critical;
  const arrow = isUp ? '▲' : '▼';

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ color: 'var(--text)' }}>{refDisplay}</span>
      {Math.abs(rounded) < 0.05
        ? <span style={{ color: palette.neutral, fontSize: '0.78em' }}>▬ 0%</span>
        : <span style={{ color, fontSize: '0.78em' }}>{arrow} {Math.abs(rounded).toFixed(1)}%</span>
      }
    </span>
  );
}

export function deltaOrNull(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

export function DeltaCell({
  delta,
  goodDirection,
  suffix = '',
  decimals = 1,
  format,
}: {
  delta: number | null;
  goodDirection: 'up' | 'down';
  suffix?: string;
  decimals?: number;
  format?: (absValue: number) => string;
}) {
  if (delta === null || !isFinite(delta)) {
    return <span>—</span>;
  }
  const rounded = Number(delta.toFixed(decimals));
  const absRounded = Math.abs(rounded);
  const displayValue = format ? format(Math.abs(delta)) : `${absRounded}${suffix}`;
  if (rounded === 0) {
    return <span style={{ color: palette.neutral }}>▬ {format ? format(0) : `0${suffix}`}</span>;
  }
  const isUp = rounded > 0;
  const isGood = goodDirection === 'up' ? isUp : !isUp;
  const color = isGood ? palette.success : palette.critical;
  const arrow = isUp ? '▲' : '▼';
  return (
    <span style={{ color }}>
      {arrow} {displayValue}
    </span>
  );
}
