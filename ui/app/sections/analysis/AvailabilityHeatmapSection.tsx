import React, { useEffect, useMemo, useState } from 'react';
import { useDql } from '@dynatrace-sdk/react-hooks';
import { getEnvironmentUrl } from '@dynatrace-sdk/app-environment';
import { SectionCard } from '../../components/SectionCard';
import { MAX_RANGE_DAYS, TimeframePicker } from '../../components/TimeframePicker';
import type { AnalysisFiltersProps } from './filters';
import { useTranslation } from '../../i18n/LanguageProvider';
import {
  AVAILABILITY_BUCKETS,
  availabilityBucket,
  BUCKET_THRESHOLDS,
  bucketColor,
  buildHeatmapQuery,
  formatCompact,
  type AvailabilityBucket,
} from './shared';

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

// `timeseries … interval: 1d` returns one array element per day plus the window it covers.
type HeatmapRecord = {
  name: string;
  workload?: string | null;
  entity_id?: string | null;
  namespace?: string | null;
  cluster?: string | null;
  timeframe?: { start?: string | null; end?: string | null } | null;
  total: (number | null)[] | null;
  failures: (number | null)[] | null;
};

type DayCell = {
  availability: number | null;
  requests: number;
  failures: number;
  bucket: AvailabilityBucket;
};

type HeatmapRow = {
  key: string;
  service: string;
  workload: string | null;
  entityId: string | null;
  cells: DayCell[];
  overall: number | null;
  requests: number;
  worstBucketRank: number;
};

type SortMode = 'worst' | 'best' | 'name' | 'traffic';

const BUCKET_RANK: Record<AvailabilityBucket, number> = { red: 0, orange: 1, yellow: 2, green: 3, none: 4 };

function buildServiceUrl(service: string, entityId: string | null): string {
  const url = new URL('/ui/apps/dynatrace.services/explorer/services', getEnvironmentUrl());
  url.searchParams.set('perspective', 'performance');
  if (entityId !== null) url.searchParams.set('detailsId', entityId);
  url.searchParams.set('sidebarOpen', 'false');
  url.searchParams.set('detailsTab', 'overview');
  const filter = encodeURIComponent(`dt.service.name = *${service}* `).replace(/%20/g, '+');
  url.hash = `filtering=${filter}`;
  return url.toString();
}

/**
 * Derives the day each array index covers from the window the query actually ran
 * over, so the column headers stay truthful even if Grail widens the interval.
 * Returns null when the timeframe is missing — the grid then falls back to ordinals.
 */
function buildDayAxis(record: HeatmapRecord | undefined, bucketCount: number): Date[] | null {
  const start = Date.parse(record?.timeframe?.start ?? '');
  const end = Date.parse(record?.timeframe?.end ?? '');
  if (isNaN(start) || isNaN(end) || bucketCount === 0 || end <= start) return null;
  const step = (end - start) / bucketCount;
  return Array.from({ length: bucketCount }, (_, index) => new Date(start + index * step));
}

function toCell(total: number | null | undefined, failures: number | null | undefined): DayCell {
  const requests = total ?? 0;
  const failed = failures ?? 0;
  if (requests <= 0) {
    return { availability: null, requests: 0, failures: 0, bucket: 'none' };
  }
  const availability = 100 - (failed / requests) * 100;
  return { availability, requests, failures: failed, bucket: availabilityBucket(availability) };
}

type AvailabilityHeatmapSectionProps = AnalysisFiltersProps & {
  /** Chosen from the namespace cards before the tabs are shown. */
  namespace: string;
};

export function AvailabilityHeatmapSection({
  namespace,
  filters,
  onFiltersChange,
}: AvailabilityHeatmapSectionProps) {
  const { t, locale } = useTranslation();
  const [sortMode, setSortMode] = useState<SortMode>('worst');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);

  const { search: searchInput, availMin, availMax, timeframe } = filters;

  // The other tab can change these while this one is hidden, so reset paging
  // here rather than in each handler — otherwise you'd come back to a page that
  // no longer exists.
  useEffect(() => { setPage(0); }, [searchInput, availMin, availMax, timeframe]);

  const range = useMemo(() => [timeframe.from, timeframe.to] as const, [timeframe]);

  const heatmapQuery = useMemo(() => buildHeatmapQuery(namespace, range), [namespace, range]);
  const heatmap = useDql<HeatmapRecord>(heatmapQuery);

  const records = useMemo(() => heatmap.data?.records ?? [], [heatmap.data]);

  const bucketCount = useMemo(
    () => records.reduce((max, record) => Math.max(max, record.total?.length ?? 0), 0),
    [records]
  );

  const dayAxis = useMemo(() => buildDayAxis(records[0], bucketCount), [records, bucketCount]);

  const rows = useMemo<HeatmapRow[]>(() => {
    // Backstop: the query already constrains the namespace, but if a segment
    // ever changed what the Smartscape lookup resolves to, a stray record
    // would silently show up as part of this namespace.
    const scoped = records.filter(
      (record) => record.namespace === null || record.namespace === undefined || record.namespace === namespace
    );
    return scoped.map((record) => {
      const cells = Array.from({ length: bucketCount }, (_, index) =>
        toCell(record.total?.[index], record.failures?.[index])
      );
      const requests = cells.reduce((sum, cell) => sum + cell.requests, 0);
      const failures = cells.reduce((sum, cell) => sum + cell.failures, 0);
      const worstBucketRank = cells.reduce(
        (worst, cell) => (cell.bucket === 'none' ? worst : Math.min(worst, BUCKET_RANK[cell.bucket])),
        BUCKET_RANK.none
      );
      return {
        key: `${record.name}\u0000${record.workload ?? ''}`,
        service: record.name,
        workload: record.workload ?? null,
        entityId: record.entity_id ?? null,
        cells,
        overall: requests > 0 ? 100 - (failures / requests) * 100 : null,
        requests,
        worstBucketRank,
      };
    });
  }, [records, bucketCount, namespace]);

  const searchedRows = useMemo(() => {
    const normalized = searchInput.trim().toLocaleLowerCase(locale);
    if (normalized.length === 0) return rows;
    return rows.filter((row) =>
      row.service.toLocaleLowerCase(locale).includes(normalized) ||
      (row.workload ?? '').toLocaleLowerCase(locale).includes(normalized)
    );
  }, [rows, searchInput, locale]);

  const visibleRows = useMemo(() => {
    // Services with no traffic at all have no availability to compare against,
    // so the slider leaves them in — same as the comparison view.
    const filtered = searchedRows.filter(
      (row) => row.overall === null || (row.overall >= availMin && row.overall <= availMax)
    );

    const byName = (a: HeatmapRow, b: HeatmapRow) => a.service.localeCompare(b.service, locale);
    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'name':
          return byName(a, b);
        case 'traffic':
          return b.requests - a.requests || byName(a, b);
        case 'best':
          return (b.overall ?? -1) - (a.overall ?? -1) || byName(a, b);
        case 'worst':
        default:
          // Surface the service with the single worst day first, then the lowest
          // overall availability — a one-day red outage matters more than a flat 99.5%.
          return (
            a.worstBucketRank - b.worstBucketRank ||
            (a.overall ?? 101) - (b.overall ?? 101) ||
            byName(a, b)
          );
      }
    });
  }, [searchedRows, availMin, availMax, sortMode, locale]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = visibleRows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const dayHeaderFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    [locale]
  );
  const dayTooltipFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'full' }),
    [locale]
  );
  const weekdayFormat = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short' }), [locale]);

  function cellTooltip(row: HeatmapRow, cell: DayCell, index: number): string {
    const day = dayAxis?.[index];
    const dayLabel = day ? dayTooltipFormat.format(day) : t('analysis.heatmap.dayOrdinal', { index: index + 1 });
    if (cell.availability === null) {
      return `${row.service} — ${dayLabel}\n${t('analysis.heatmap.noTraffic')}`;
    }
    return [
      `${row.service} — ${dayLabel}`,
      `${t('analysis.kpi.availability')}: ${cell.availability.toFixed(3)}%`,
      `${t('analysis.kpi.throughput')}: ${formatCompact(cell.requests, locale)}`,
      `${t('analysis.heatmap.failedRequests')}: ${formatCompact(cell.failures, locale)}`,
    ].join('\n');
  }

  const bucketLegendLabel: Record<Exclude<AvailabilityBucket, 'none'>, string> = {
    green: `≥ ${BUCKET_THRESHOLDS.green}%`,
    yellow: `${BUCKET_THRESHOLDS.yellow}% – ${BUCKET_THRESHOLDS.green}%`,
    orange: `${BUCKET_THRESHOLDS.orange}% – ${BUCKET_THRESHOLDS.yellow}%`,
    red: `< ${BUCKET_THRESHOLDS.orange}%`,
  };

  const sortOptions: { mode: SortMode; label: string }[] = [
    { mode: 'worst', label: t('analysis.heatmap.sort.worst') },
    { mode: 'best', label: t('analysis.heatmap.sort.best') },
    { mode: 'traffic', label: t('analysis.heatmap.sort.traffic') },
    { mode: 'name', label: t('analysis.heatmap.sort.name') },
  ];

  return (
    <div className="page">
      <div className="heatmap-controls">
        <TimeframePicker
          value={timeframe}
          onChange={(next) => onFiltersChange({ timeframe: next })}
        />

        <div className="heatmap-controls-row">
          <div className="analysis-search">
            <label htmlFor="heatmap-service-search">{t('analysis.serviceSearch.label')}</label>
            <div className="analysis-search-controls">
              <input
                id="heatmap-service-search"
                type="search"
                value={searchInput}
                placeholder={t('analysis.serviceSearch.placeholder')}
                onChange={(event) => onFiltersChange({ search: event.target.value })}
              />
            </div>
          </div>

          <div className="dual-range-filter">
            <div className="dual-range-filter-inner">
              <label>{t('analysis.availFilter.label')}</label>
              <div className="dual-range-values">
                <span><strong>{availMin.toFixed(1)}%</strong> – <strong>{availMax.toFixed(1)}%</strong></span>
                {visibleRows.length !== searchedRows.length && (
                  <span style={{ color: 'var(--muted)' }}>
                    {t('analysis.availFilter.counter', { filtered: visibleRows.length, total: searchedRows.length })}
                  </span>
                )}
              </div>
              <div className="dual-range-track-wrap">
                <div
                  className="dual-range-track-bg"
                  style={{
                    background: `linear-gradient(to right, var(--border, #dfe7f4) ${availMin}%, var(--primary, #1f9d61) ${availMin}%, var(--primary, #1f9d61) ${availMax}%, var(--border, #dfe7f4) ${availMax}%)`,
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={availMin}
                  aria-label={`${t('analysis.availFilter.label')} — ${t('analysis.timeframe.from')}`}
                  style={{ zIndex: availMin >= availMax - 1 ? 3 : 2 }}
                  onChange={(e) => onFiltersChange({ availMin: Math.min(parseFloat(e.target.value), availMax - 0.1) })}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={availMax}
                  aria-label={`${t('analysis.availFilter.label')} — ${t('analysis.timeframe.to')}`}
                  style={{ zIndex: 2 }}
                  onChange={(e) => onFiltersChange({ availMax: Math.max(parseFloat(e.target.value), availMin + 0.1) })}
                />
              </div>
              <div className="dual-range-ticks">
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>
          </div>

          <div className="heatmap-field">
            <span>{t('analysis.sort.label')}</span>
            <div className="sort-quick-group" role="group" aria-label={t('analysis.sort.label')}>
              {sortOptions.map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  className={`sort-quick-btn${sortMode === option.mode ? ' active' : ''}`}
                  onClick={() => { setSortMode(option.mode); setPage(0); }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="heatmap-legend" aria-label={t('analysis.heatmap.legend')}>
          <span className="heatmap-legend-title">{t('analysis.heatmap.legend')}</span>
          {AVAILABILITY_BUCKETS.map((bucket) => (
            <span key={bucket} className="heatmap-legend-item">
              <span className="heatmap-legend-swatch" style={{ background: bucketColor(bucket) }} />
              {bucketLegendLabel[bucket as Exclude<AvailabilityBucket, 'none'>]}
            </span>
          ))}
          <span className="heatmap-legend-item">
            <span className="heatmap-legend-swatch heatmap-legend-swatch-none" />
            {t('analysis.heatmap.noTraffic')}
          </span>
        </div>
      </div>

      <SectionCard
        title={t('analysis.heatmap.title', {
          namespace,
          days: bucketCount > 0 ? bucketCount : timeframe.days,
        })}
        isLoading={heatmap.isLoading}
        error={heatmap.error}
        isEmpty={rows.length === 0}
        emptyMessage={t('analysis.heatmap.empty')}
      >
        <div className="toolbar-row" style={{ justifyContent: 'space-between', paddingBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <div className="toolbar-row" style={{ gap: 6 }}>
            <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{t('analysis.pagination.perPage')}</span>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                className={`sort-quick-btn${pageSize === size ? ' active' : ''}`}
                onClick={() => { setPageSize(size); setPage(0); }}
              >
                {size}
              </button>
            ))}
            <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
              {t('analysis.serviceCount', { count: visibleRows.length })}
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

        {visibleRows.length === 0 ? (
          <div className="empty-state">
            {searchedRows.length === 0
              ? t('analysis.serviceSearch.empty', { search: searchInput })
              : t('analysis.availFilter.empty', { min: availMin.toFixed(1), max: availMax.toFixed(1) })}
          </div>
        ) : (
          <div className="heatmap-scroll">
            <table className="heatmap-table">
              <thead>
                <tr>
                  <th className="heatmap-service-col">{t('analysis.col.service')}</th>
                  <th className="heatmap-overall-col">{t('analysis.heatmap.overall')}</th>
                  {Array.from({ length: bucketCount }, (_, index) => {
                    const day = dayAxis?.[index];
                    return (
                      <th key={index} className="heatmap-day-col" scope="col">
                        {day ? (
                          <>
                            <span className="heatmap-day-weekday">{weekdayFormat.format(day)}</span>
                            <span className="heatmap-day-date">{dayHeaderFormat.format(day)}</span>
                          </>
                        ) : (
                          <span className="heatmap-day-date">{t('analysis.heatmap.dayOrdinal', { index: index + 1 })}</span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="heatmap-service-col">
                      <div className="service-identity">
                        <a
                          className="service-link"
                          href={buildServiceUrl(row.service, row.entityId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t('analysis.openService', { service: row.service })}
                        >
                          {row.service}
                        </a>
                        <span className="workload-name">
                          {t('analysis.workload')}: {row.workload ?? t('analysis.workloadUnavailable')}
                        </span>
                      </div>
                    </th>
                    <td className="heatmap-overall-col">
                      <span style={{ color: row.overall === null ? 'var(--muted)' : bucketColor(availabilityBucket(row.overall)) }}>
                        {row.overall === null ? '—' : `${row.overall.toFixed(2)}%`}
                      </span>
                      <span className="heatmap-overall-requests">{formatCompact(row.requests, locale)}</span>
                    </td>
                    {row.cells.map((cell, index) => (
                      <td key={index} className="heatmap-day-col">
                        <span
                          className={`heatmap-cell heatmap-cell-${cell.bucket}`}
                          style={cell.bucket === 'none' ? undefined : { background: bucketColor(cell.bucket) }}
                          title={cellTooltip(row, cell, index)}
                        >
                          {cell.availability === null ? '—' : `${cell.availability.toFixed(1)}`}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <p className="heatmap-footnote">
        {t('analysis.heatmap.footnote', { max: MAX_RANGE_DAYS })}
      </p>
    </div>
  );
}
