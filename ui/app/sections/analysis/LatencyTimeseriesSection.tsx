import React, { useEffect, useMemo, useState } from 'react';
import { useDql } from '@dynatrace-sdk/react-hooks';
import { useProgressiveLoading } from '../../hooks/useProgressiveLoading';
import { TimeseriesChart } from '@dynatrace/strato-components/charts';
import type { Formatter, Timeseries } from '@dynatrace/strato-components/charts';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { SectionCard } from '../../components/SectionCard';
import { useTranslation } from '../../i18n/LanguageProvider';
import type { AnalysisFiltersProps } from './filters';
import { TimeframePicker } from '../../components/TimeframePicker';
import {
  availabilityFormat,
  buildTimeseriesQuery,
  latencyFormat,
  type TimeseriesRecord,
} from './shared';

// ── constants ─────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const C = {
  p50:          '#17a2a2',
  p90:          '#9b7fe0',
  p99:          '#cc55d4',
  availability: '#1f9d61',
  throughput:   '#4c9aff',
  errorRate:    '#cb3a31',
};

// ── axis formatters ───────────────────────────────────────
// Values in the latency chart are in ms (µs / 1000 in toStrato).
const latencyFormatter: Formatter = (v) => {
  if (v >= 60_000) return `${(v / 60_000).toFixed(1)} min`;
  if (v >= 1_000)  return `${(v / 1_000).toFixed(2)} s`;
  return `${v.toFixed(1)} ms`;
};

// Raw request counts — abbreviate large numbers
const throughputFormatter: Formatter = (v) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
};

// 0–100 range for availability and error rate
const percentFormatter: Formatter = (v) => `${v.toFixed(1)}%`;

// ── types ─────────────────────────────────────────────────

type TimeseriesSectionProps = AnalysisFiltersProps & { namespace: string };

type ServiceSummary = {
  // entity_id is the unique key — two services can share the same display name
  entityId:     string;
  name:         string;
  workload:     string | undefined;
  availability: number | null;
  p90AvgMs:     number | null;
};

type FlatSeries = {
  total:      (number | null)[];
  failures:   (number | null)[];
  p50Latency: (number | null)[];
  p90Latency: (number | null)[];
  p99Latency: (number | null)[];
  start: Date;
  end:   Date;
};

type ChartSet = {
  latencyP50:   Timeseries;
  latencyP90:   Timeseries;
  latencyP99:   Timeseries;
  availability: Timeseries;
  throughput:   Timeseries;
  errorRate:    Timeseries;
};

// ── helpers ───────────────────────────────────────────────

function arrayGetVal(arr: (number | null)[], i: number): number | null {
  return i < arr.length ? arr[i] : null;
}

function toStrato(
  name: string,
  values: (number | null)[],
  start: Date,
  end: Date,
  scale = 1,
): Timeseries {
  const n = values.length;
  if (n === 0) return { name, datapoints: [] };
  const stepMs = (end.getTime() - start.getTime()) / n;
  return {
    name,
    datapoints: values.reduce<Timeseries['datapoints']>((acc, v, i) => {
      if (v !== null && isFinite(v)) {
        acc.push({
          start: new Date(start.getTime() + i * stepMs),
          end:   new Date(start.getTime() + (i + 1) * stepMs),
          value: v / scale,
        });
      }
      return acc;
    }, []),
  };
}

function aggregate(records: TimeseriesRecord[]): FlatSeries | null {
  const ref = records.find((r) => r.timeframe);
  if (!ref?.timeframe) return null;
  const start  = new Date(ref.timeframe.start);
  const end    = new Date(ref.timeframe.end);
  const maxLen = Math.max(0, ...records.map((r) => r.total.length));
  if (maxLen === 0) return null;

  const total    = new Array<number>(maxLen).fill(0);
  const failures = new Array<number>(maxLen).fill(0);
  const p50W     = new Array<number>(maxLen).fill(0);
  const p90W     = new Array<number>(maxLen).fill(0);
  const p99W     = new Array<number>(maxLen).fill(0);

  for (const r of records) {
    for (let i = 0; i < maxLen; i++) {
      const t = arrayGetVal(r.total, i) ?? 0;
      const f = arrayGetVal(r.failures, i) ?? 0;
      total[i]    += t;
      failures[i] += f;
      p50W[i]     += (arrayGetVal(r.p50_latency, i) ?? 0) * t;
      p90W[i]     += (arrayGetVal(r.p90_latency, i) ?? 0) * t;
      p99W[i]     += (arrayGetVal(r.p99_latency, i) ?? 0) * t;
    }
  }

  return {
    total,
    failures,
    p50Latency: total.map((t, i) => t > 0 ? p50W[i] / t : null),
    p90Latency: total.map((t, i) => t > 0 ? p90W[i] / t : null),
    p99Latency: total.map((t, i) => t > 0 ? p99W[i] / t : null),
    start,
    end,
  };
}

function flatFromRecord(rec: TimeseriesRecord): FlatSeries | null {
  if (!rec.timeframe) return null;
  return {
    total:      rec.total,
    failures:   rec.failures,
    p50Latency: rec.p50_latency,
    p90Latency: rec.p90_latency,
    p99Latency: rec.p99_latency,
    start: new Date(rec.timeframe.start),
    end:   new Date(rec.timeframe.end),
  };
}

type SeriesLabels = { p50: string; p90: string; p99: string; avail: string; thru: string; err: string };

function buildChartSet(flat: FlatSeries, lbl: SeriesLabels): ChartSet {
  const { total, failures, p50Latency, p90Latency, p99Latency, start, end } = flat;

  const availValues = total.map((totalVal, i) =>
    (totalVal ?? 0) > 0 ? (1 - (failures[i] ?? 0) / totalVal!) * 100 : null,
  );
  const errorValues = total.map((totalVal, i) =>
    (totalVal ?? 0) > 0 ? ((failures[i] ?? 0) / totalVal!) * 100 : null,
  );

  return {
    latencyP50:   toStrato(lbl.p50,   p50Latency,   start, end, 1000),
    latencyP90:   toStrato(lbl.p90,   p90Latency,   start, end, 1000),
    latencyP99:   toStrato(lbl.p99,   p99Latency,   start, end, 1000),
    availability: toStrato(lbl.avail, availValues,  start, end),
    throughput:   toStrato(lbl.thru,  total,         start, end),
    errorRate:    toStrato(lbl.err,   errorValues,  start, end),
  };
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="timeseries-chart-card">
      <div className="timeseries-chart-card-title">{title}</div>
      {children}
    </div>
  );
}

// ── component ─────────────────────────────────────────────

export function TimeseriesSection({
  namespace,
  filters,
  onFiltersChange,
}: TimeseriesSectionProps) {
  const { t, locale } = useTranslation();

  // Read all filters from shared state — identical to Comparison and Heatmap tabs
  const search   = filters.search;
  const availMin = filters.availMin;
  const availMax = filters.availMax;
  const timeframe = filters.timeframe;

  const [page, setPage]             = useState(0);
  const [pageSize, setPageSize]     = useState<number>(20);
  // Selection is keyed by entity_id to handle services that share the same display name
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reset page when filters change (search or availability range)
  useEffect(() => { setPage(0); }, [search, availMin, availMax]);
  // Reset selection only when namespace changes (not on timeframe or filter changes)
  useEffect(() => { setSelectedId(null); }, [namespace]);

  const query = useMemo(
    () => buildTimeseriesQuery(namespace, [timeframe.from, timeframe.to], timeframe.days),
    [namespace, timeframe],
  );
  const { data, isLoading, error } = useDql<TimeseriesRecord>(query);

  // Pass namespace as resetKey so keepMounted tabs show Skeleton (not ProgressCircle)
  // on namespace change instead of briefly showing stale data from the previous namespace.
  const { firstLoading, reloading } = useProgressiveLoading(isLoading, data, namespace);

  // Backstop: DQL namespace filter is inside the subquery, but guard client-side too
  const freshRecords = useMemo(
    () => (data?.records ?? []).filter(
      (r) => r.namespace === undefined || r.namespace === namespace,
    ),
    [data, namespace],
  );

  // Stale-while-revalidate using state so re-renders are guaranteed when new data
  // arrives. During a timeframe re-fetch the service list stays populated with the
  // previous result; once the query settles the state update triggers a re-render
  // and the list shows the new (potentially larger) set of services.
  // Cleared immediately on namespace change so namespace-A data never leaks into B.
  const [stableRecords, setStableRecords] = useState<TimeseriesRecord[]>([]);

  useEffect(() => { setStableRecords([]); }, [namespace]);

  useEffect(() => {
    if (!isLoading && !error) {
      setStableRecords(freshRecords);   // captures the new result, including new services
    }
  }, [isLoading, error, freshRecords]);

  // Show stale while the query is in flight; switch to fresh as soon as it resolves.
  // Using isLoading directly (not reloading) keeps this independent of the
  // useProgressiveLoading ref timing.
  const records = isLoading && stableRecords.length > 0 ? stableRecords : freshRecords;

  // Build summaries. Depends on records (which change when data loads) AND on search/avail.
  // Keeping these as separate memos ensures that when only the search text changes,
  // we don't recompute the expensive aggregation over the full records array.
  const summaries = useMemo<ServiceSummary[]>(() => records.map((r) => {
    const totalSum   = r.total.reduce<number>((a, v) => a + (v ?? 0), 0);
    const failureSum = r.failures.reduce<number>((a, v) => a + (v ?? 0), 0);
    const avail      = totalSum > 0 ? (1 - failureSum / totalSum) * 100 : null;
    const p90Vals    = r.p90_latency.filter((v): v is number => v !== null);
    const p90AvgMs   = p90Vals.length > 0
      ? p90Vals.reduce((a, b) => a + b, 0) / p90Vals.length / 1000
      : null;
    // Use entity_id as the canonical key; fall back to name only if absent
    const entityId = r.entity_id ?? r.name;
    return { entityId, name: r.name, workload: r.workload, availability: avail, p90AvgMs };
  }), [records]);

  // Text search: match on service name OR workload
  const searchedSummaries = useMemo(() => {
    const q = search.trim().toLocaleLowerCase(locale);
    if (q.length === 0) return summaries;
    return summaries.filter((s) =>
      s.name.toLocaleLowerCase(locale).includes(q) ||
      (s.workload ?? '').toLocaleLowerCase(locale).includes(q),
    );
  }, [summaries, search, locale]);

  // Availability range filter
  const filteredSummaries = useMemo(() =>
    searchedSummaries.filter((s) => {
      if (s.availability === null) return true;
      return s.availability >= availMin && s.availability <= availMax;
    }),
  [searchedSummaries, availMin, availMax]);

  const totalPages = Math.max(1, Math.ceil(filteredSummaries.length / pageSize));
  const safePage   = Math.min(page, totalPages - 1);
  const pageItems  = filteredSummaries.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const seriesLabels = useMemo<SeriesLabels>(() => ({
    p50:   t('analysis.timeseries.p50'),
    p90:   t('analysis.timeseries.p90'),
    p99:   t('analysis.timeseries.p99'),
    avail: t('analysis.kpi.availability'),
    thru:  t('analysis.kpi.throughput'),
    err:   t('analysis.kpi.errorRate'),
  }), [t]);

  const charts = useMemo<ChartSet | null>(() => {
    if (records.length === 0) return null;
    let flat: FlatSeries | null;
    if (selectedId !== null) {
      // Find by entity_id — unique even when two services share the same name
      const rec = records.find((r) => (r.entity_id ?? r.name) === selectedId);
      flat = rec ? flatFromRecord(rec) : null;
    } else {
      flat = aggregate(records);
    }
    return flat ? buildChartSet(flat, seriesLabels) : null;
  }, [records, selectedId, seriesLabels]);

  // Derive the display name of the currently selected service (for the subtitle)
  const selectedName = useMemo(
    () => selectedId !== null
      ? records.find((r) => (r.entity_id ?? r.name) === selectedId)?.name ?? null
      : null,
    [records, selectedId],
  );

  return (
    <div className="page">
      <SectionCard
        title={t('analysis.timeseries.title', { namespace })}
        isLoading={firstLoading}
        reloading={reloading}
        error={error}
        isEmpty={records.length === 0}
        emptyMessage={t('analysis.services.empty')}
      >
        {/* ── Shared filter bar — stable, never affected by chart reload ── */}
        <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
          <div className="analysis-search">
            <label htmlFor="ts-search-input">{t('analysis.serviceSearch.label')}</label>
            <div className="analysis-search-controls">
              <input
                id="ts-search-input"
                type="search"
                value={search}
                placeholder={t('analysis.serviceSearch.placeholder')}
                onChange={(e) => onFiltersChange({ search: e.target.value })}
              />
            </div>
          </div>

          <div className="dual-range-filter">
            <div className="dual-range-filter-inner">
              <label>{t('analysis.availFilter.label')}</label>
              <div className="dual-range-values">
                <span><strong>{availMin.toFixed(1)}%</strong> – <strong>{availMax.toFixed(1)}%</strong></span>
                {filteredSummaries.length !== searchedSummaries.length && (
                  <span style={{ color: 'var(--muted)' }}>
                    {t('analysis.availFilter.counter', { filtered: filteredSummaries.length, total: searchedSummaries.length })}
                  </span>
                )}
              </div>
              <div className="dual-range-track-wrap">
                <div
                  className="dual-range-track-bg"
                  style={{
                    background: `linear-gradient(to right, var(--border,#dfe7f4) ${availMin}%, var(--primary,#1f9d61) ${availMin}%, var(--primary,#1f9d61) ${availMax}%, var(--border,#dfe7f4) ${availMax}%)`,
                  }}
                />
                <input type="range" min={0} max={100} step={0.1} value={availMin}
                  style={{ zIndex: availMin >= availMax - 1 ? 3 : 2 }}
                  onChange={(e) => onFiltersChange({ availMin: Math.min(parseFloat(e.target.value), availMax - 0.1) })}
                />
                <input type="range" min={0} max={100} step={0.1} value={availMax}
                  style={{ zIndex: 2 }}
                  onChange={(e) => onFiltersChange({ availMax: Math.max(parseFloat(e.target.value), availMin + 0.1) })}
                />
              </div>
              <div className="dual-range-ticks">
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>
          </div>

          <TimeframePicker value={timeframe} onChange={(tf) => onFiltersChange({ timeframe: tf })} />
        </div>

        {/* ── Per-page + pagination — stable ── */}
        {filteredSummaries.length > 0 && (
          <div className="toolbar-row" style={{ justifyContent: 'space-between', paddingBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div className="toolbar-row" style={{ gap: 6 }}>
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{t('analysis.pagination.perPage')}</span>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <button key={n} type="button"
                  className={`sort-quick-btn${pageSize === n ? ' active' : ''}`}
                  onClick={() => { setPageSize(n); setPage(0); }}
                >{n}</button>
              ))}
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                {t('analysis.serviceCount', { count: filteredSummaries.length })}
              </span>
            </div>
            {totalPages > 1 && (
              <div className="toolbar-row" style={{ gap: 8 }}>
                <button className="secondary-button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                  {t('analysis.pagination.prev')}
                </button>
                <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                  {t('analysis.pagination.page', { page: safePage + 1, total: totalPages })}
                </span>
                <button className="secondary-button" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
                  {t('analysis.pagination.next')}
                </button>
              </div>
            )}
          </div>
        )}

        {filteredSummaries.length === 0 && !isLoading ? (
          <div className="empty-state">{t('analysis.serviceSearch.empty', { search })}</div>
        ) : (
          <div className="timeseries-layout">
            {/* ── Service list (left) — always stable; stale records kept during reload ── */}
            <div className="timeseries-service-list">
              {pageItems.map((s) => {
                const avail = availabilityFormat(s.availability);
                const lat   = latencyFormat(s.p90AvgMs);
                const isSel = s.entityId === selectedId;
                return (
                  <button key={s.entityId} type="button"
                    className={`timeseries-service-item${isSel ? ' selected' : ''}`}
                    onClick={() => setSelectedId(isSel ? null : s.entityId)}
                  >
                    <span className="timeseries-service-name">{s.name}</span>
                    {s.workload && (
                      <span className="timeseries-service-workload">{s.workload}</span>
                    )}
                    <div className="timeseries-service-meta">
                      <span style={{ color: avail.color ?? 'var(--text)' }}>{avail.text}</span>
                      <span style={{ color: lat.color ?? 'var(--muted)', fontSize: '0.8rem' }}>P90 {lat.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Charts (right) — shows ProgressCircle in its own header during reload ── */}
            <div className="timeseries-charts-area">
              <div className="timeseries-charts-subtitle">
                {selectedName !== null ? (
                  <>
                    <span>{selectedName}</span>
                    <button type="button" className="secondary-button"
                      style={{ padding: '2px 8px', fontSize: '0.78rem' }}
                      onClick={() => setSelectedId(null)}>✕</button>
                  </>
                ) : (
                  <span style={{ color: 'var(--muted)' }}>
                    {t('analysis.timeseries.globalLabel', { namespace })}
                  </span>
                )}
                {/* Only the charts area shows a loading indicator during timeframe re-fetches */}
                {reloading && (
                  <ProgressCircle
                    value="indeterminate"
                    size="small"
                    aria-label={t('common.loading')}
                  />
                )}
              </div>

              {charts !== null ? (
                <div className="timeseries-charts-grid">
                  <ChartCard title={t('analysis.timeseries.chartLatency')}>
                    <TimeseriesChart height={200}>
                      <TimeseriesChart.Line data={charts.latencyP50} color={C.p50} />
                      <TimeseriesChart.Line data={charts.latencyP90} color={C.p90} />
                      <TimeseriesChart.Line data={charts.latencyP99} color={C.p99} />
                      <TimeseriesChart.YAxis formatter={latencyFormatter} scale="linear" min={0} />
                      <TimeseriesChart.Tooltip variant="shared" />
                      <TimeseriesChart.Legend position="bottom" />
                    </TimeseriesChart>
                  </ChartCard>

                  <ChartCard title={t('analysis.timeseries.chartAvailability')}>
                    <TimeseriesChart height={200}>
                      <TimeseriesChart.Line data={charts.availability} color={C.availability} />
                      <TimeseriesChart.YAxis formatter={percentFormatter} scale="linear" min={0} max={100} />
                      <TimeseriesChart.Tooltip variant="shared" />
                      <TimeseriesChart.Legend position="bottom" />
                    </TimeseriesChart>
                  </ChartCard>

                  <ChartCard title={t('analysis.timeseries.chartThroughput')}>
                    <TimeseriesChart height={200} variant="bar">
                      <TimeseriesChart.Bar data={charts.throughput} color={C.throughput} />
                      <TimeseriesChart.YAxis formatter={throughputFormatter} scale="linear" min={0} />
                      <TimeseriesChart.Tooltip variant="shared" />
                      <TimeseriesChart.Legend position="bottom" />
                    </TimeseriesChart>
                  </ChartCard>

                  <ChartCard title={t('analysis.timeseries.chartErrorRate')}>
                    <TimeseriesChart height={200} variant="bar">
                      <TimeseriesChart.Bar data={charts.errorRate} color={C.errorRate} />
                      <TimeseriesChart.YAxis formatter={percentFormatter} scale="linear" min={0} />
                      <TimeseriesChart.Tooltip variant="shared" />
                      <TimeseriesChart.Legend position="bottom" />
                    </TimeseriesChart>
                  </ChartCard>
                </div>
              ) : (
                <div className="empty-state">{t('analysis.timeseries.noData')}</div>
              )}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
