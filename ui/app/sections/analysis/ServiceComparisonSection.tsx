import React, { useEffect, useMemo, useState } from 'react';
import { useDql } from '@dynatrace-sdk/react-hooks';
import { getEnvironmentUrl } from '@dynatrace-sdk/app-environment';
import { SectionCard } from '../../components/SectionCard';
import { TableWrapToggle } from '../../components/TableWrapToggle';
import { ResizableTh } from '../../components/ResizableTh';
import { useTranslation } from '../../i18n/LanguageProvider';
import type { AnalysisFiltersProps } from './filters';
import {
  availabilityFormat,
  buildServiceQuery,
  errorRateFormat,
  formatCompact,
  KpiCell,
  latencyFormat,
  ReferenceDeltaCell,
  throughputFormat,
  toKpis,
  type Kpis,
  type MetricRecord,
} from './shared';

/**
 * Deliberately fixed, and deliberately not driven by the shared timeframe: this
 * view answers the on-call question "how does now compare to yesterday and to
 * last week". Each reference is the *same 24h window* shifted back, not a
 * running total — see `analysis.services.windowNote`.
 */
const TIMEFRAMES = {
  current: ['now()-24h', 'now()'],
  previousDay: ['now()-48h', 'now()-24h'],
  previousWeek: ['now()-8d', 'now()-7d'],
} as const;

type ServiceRow = {
  key: string;
  service: string;
  entityId?: string;
  workload?: string;
  current: Kpis;
  ref1d: Kpis; // raw values from yesterday's same 24h window
  ref7d: Kpis; // raw values from 7 days ago same 24h window
};

type ServiceComparisonSectionProps = AnalysisFiltersProps & {
  namespace: string;
};

type MetricKey = keyof Kpis;
type MetricPeriod = 'current' | 'ref1d' | 'ref7d';
type SortField = 'service' | `${MetricPeriod}.${MetricKey}`;
type SortDirection = 'asc' | 'desc';

function buildServiceUrl(service: string, entityId: string | undefined): string {
  const url = new URL('/ui/apps/dynatrace.services/explorer/services', getEnvironmentUrl());
  url.searchParams.set('perspective', 'performance');
  url.searchParams.set('sort', 'healthIndicators:descending');
  if (entityId !== undefined) url.searchParams.set('detailsId', entityId);
  url.searchParams.set('sidebarOpen', 'false');
  url.searchParams.set('detailsTab', 'overview');

  const filter = encodeURIComponent(`dt.service.name = *${service}* `).replace(/%20/g, '+');
  url.hash = `filtering=${filter}`;
  return url.toString();
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export function ServiceComparisonSection({
  namespace,
  filters,
  onFiltersChange,
}: ServiceComparisonSectionProps) {
  const { t, locale } = useTranslation();
  const [fitScreen, setFitScreen] = useState(true);
  const [wrapText, setWrapText] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(20);
  const [sortField, setSortField] = useState<SortField>('current.throughput');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { search: searchInput, availMin, availMax } = filters;

  // The other tab can change these while this one is hidden, so reset paging
  // here rather than in each handler — otherwise you'd come back to a page that
  // no longer exists.
  useEffect(() => { setPage(0); }, [searchInput, availMin, availMax]);

  const currentQuery = useMemo(() => buildServiceQuery(namespace, TIMEFRAMES.current), [namespace]);
  const dayQuery = useMemo(() => buildServiceQuery(namespace, TIMEFRAMES.previousDay), [namespace]);
  const weekQuery = useMemo(() => buildServiceQuery(namespace, TIMEFRAMES.previousWeek), [namespace]);

  const current = useDql<MetricRecord>(currentQuery);
  const previousDay = useDql<MetricRecord>(dayQuery);
  const previousWeek = useDql<MetricRecord>(weekQuery);

  const rows = useMemo<ServiceRow[]>(() => {
    const recordKey = (record: MetricRecord) => `${record.name}\u0000${record.workload ?? ''}`;
    const index = (records: MetricRecord[] | undefined) => {
      const map = new Map<string, MetricRecord>();
      for (const record of records ?? []) {
        // Backstop: the query already constrains the namespace, but if a
        // segment ever changed what the Smartscape lookup resolves to, a
        // stray record would silently show up as part of this namespace.
        if (record.namespace !== undefined && record.namespace !== namespace) continue;
        map.set(recordKey(record), record);
      }
      return map;
    };
    const curMap = index(current.data?.records);
    const dayMap = index(previousDay.data?.records);
    const weekMap = index(previousWeek.data?.records);

    // Only show services with data in the current 24h window — avoids all-null rows.
    return Array.from(curMap.keys())
      .map((key) => {
        const currentRecord = curMap.get(key)!;
        const dayRecord = dayMap.get(key);
        const weekRecord = weekMap.get(key);
        return {
          key,
          service: currentRecord.name,
          entityId: currentRecord.entity_id ?? dayRecord?.entity_id ?? weekRecord?.entity_id,
          workload: currentRecord.workload,
          current: toKpis(currentRecord),
          ref1d: toKpis(dayRecord),
          ref7d: toKpis(weekRecord),
        };
      })
      .sort((a, b) => (b.current.throughput ?? 0) - (a.current.throughput ?? 0));
  }, [current.data, previousDay.data, previousWeek.data, namespace]);

  const metricColumns = [
    {
      key: 'availability',
      title: t('analysis.kpi.availability'),
      getCurrent: (row: ServiceRow) => row.current.availability,
      getRef1d: (row: ServiceRow) => row.ref1d.availability,
      getRef7d: (row: ServiceRow) => row.ref7d.availability,
      currentCell: (value: number | null) => <KpiCell formatted={availabilityFormat(value)} />,
      goodDirection: 'up' as const,
      formatRef: (v: number) => `${v.toFixed(2)}%`,
    },
    {
      key: 'errorRate',
      title: t('analysis.kpi.errorRate'),
      getCurrent: (row: ServiceRow) => row.current.errorRate,
      getRef1d: (row: ServiceRow) => row.ref1d.errorRate,
      getRef7d: (row: ServiceRow) => row.ref7d.errorRate,
      currentCell: (value: number | null) => <KpiCell formatted={errorRateFormat(value)} />,
      goodDirection: 'down' as const,
      formatRef: (v: number) => `${v.toFixed(2)}%`,
    },
    {
      key: 'throughput',
      title: t('analysis.kpi.throughput'),
      getCurrent: (row: ServiceRow) => row.current.throughput,
      getRef1d: (row: ServiceRow) => row.ref1d.throughput,
      getRef7d: (row: ServiceRow) => row.ref7d.throughput,
      currentCell: (value: number | null) => <KpiCell formatted={throughputFormat(value, locale)} />,
      goodDirection: 'up' as const,
      formatRef: (v: number) => formatCompact(v, locale),
    },
    {
      key: 'latency',
      title: t('analysis.kpi.latency'),
      getCurrent: (row: ServiceRow) => row.current.latency,
      getRef1d: (row: ServiceRow) => row.ref1d.latency,
      getRef7d: (row: ServiceRow) => row.ref7d.latency,
      currentCell: (value: number | null) => <KpiCell formatted={latencyFormat(value)} />,
      goodDirection: 'down' as const,
      formatRef: (v: number) => `${v.toFixed(1)} ms`,
    },
  ];

  const isLoading = current.isLoading || previousDay.isLoading || previousWeek.isLoading;
  const error = current.error ?? previousDay.error ?? previousWeek.error;
  const filteredRows = useMemo(() => {
    const normalizedSearch = searchInput.trim().toLocaleLowerCase(locale);
    if (normalizedSearch.length === 0) return rows;
    return rows.filter((row) =>
      row.service.toLocaleLowerCase(locale).includes(normalizedSearch) ||
      (row.workload ?? '').toLocaleLowerCase(locale).includes(normalizedSearch)
    );
  }, [locale, rows, searchInput]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((left, right) => {
      if (sortField === 'service') {
        const comparison = left.service.localeCompare(right.service, locale);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      const [period, metric] = sortField.split('.') as [MetricPeriod, MetricKey];
      const leftValue = left[period][metric];
      const rightValue = right[period][metric];
      if (leftValue === null && rightValue === null) return left.service.localeCompare(right.service, locale);
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;

      const comparison = leftValue - rightValue;
      if (comparison === 0) return left.service.localeCompare(right.service, locale);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, locale, sortDirection, sortField]);

  const rangeFilteredRows = useMemo(
    () => sortedRows.filter((row) => {
      const a = row.current.availability;
      if (a === null) return true;
      return a >= availMin && a <= availMax;
    }),
    [sortedRows, availMin, availMax]
  );

  const totalPages = Math.max(1, Math.ceil(rangeFilteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rangeFilteredRows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function changeSort(nextField: SortField) {
    if (nextField === sortField) {
      setSortDirection((currentDirection) => currentDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(nextField);
      setSortDirection(nextField === 'service' ? 'asc' : 'desc');
    }
    setPage(0);
  }

  function sortControl(label: string, field: SortField) {
    const isActive = field === sortField;
    const directionLabel = sortDirection === 'asc' ? t('table.ascending') : t('table.descending');
    return (
      <button
        type="button"
        className={`sort-button ${isActive ? 'active' : ''}`}
        onClick={() => changeSort(field)}
        aria-label={`${t('table.sortBy', { column: label })}${isActive ? `, ${directionLabel}` : ''}`}
      >
        <span>{label}</span>
        <span className="sort-indicator" aria-hidden="true">{isActive ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    );
  }

  return (
    <div className="page">
      <SectionCard
        title={t('analysis.services.title', { namespace })}
        isLoading={isLoading}
        error={error}
        isEmpty={rows.length === 0}
        emptyMessage={t('analysis.services.empty')}
      >
        <p className="view-note">{t('analysis.services.windowNote')}</p>

        {rangeFilteredRows.length > 0 && (
          <div className="toolbar-row" style={{ justifyContent: 'space-between', paddingBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div className="toolbar-row" style={{ gap: 6 }}>
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{t('analysis.pagination.perPage')}</span>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`sort-quick-btn${pageSize === n ? ' active' : ''}`}
                  onClick={() => { setPageSize(n); setPage(0); }}
                >
                  {n}
                </button>
              ))}
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                {t('analysis.serviceCount', { count: rangeFilteredRows.length })}
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

        <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
          <div className="analysis-search">
            <label htmlFor="service-search-input">{t('analysis.serviceSearch.label')}</label>
            <div className="analysis-search-controls">
              <input
                id="service-search-input"
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
                {rangeFilteredRows.length !== sortedRows.length && (
                  <span style={{ color: 'var(--muted)' }}>{t('analysis.availFilter.counter', { filtered: rangeFilteredRows.length, total: sortedRows.length })}</span>
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
                  style={{ zIndex: availMin >= availMax - 1 ? 3 : 2 }}
                  onChange={(e) => onFiltersChange({ availMin: Math.min(parseFloat(e.target.value), availMax - 0.1) })}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={availMax}
                  style={{ zIndex: 2 }}
                  onChange={(e) => onFiltersChange({ availMax: Math.max(parseFloat(e.target.value), availMin + 0.1) })}
                />
              </div>
              <div className="dual-range-ticks">
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>
          </div>
          <div className="toolbar-row" style={{ gap: 8 }}>
            <div className="sort-quick-group" role="group" aria-label={t('analysis.sort.label')}>
              <button
                type="button"
                className={`sort-quick-btn${sortField === 'current.availability' && sortDirection === 'desc' ? ' active' : ''}`}
                onClick={() => { setSortField('current.availability'); setSortDirection('desc'); }}
              >
                {t('analysis.sort.availability')} ▼
              </button>
              <button
                type="button"
                className={`sort-quick-btn${sortField === 'current.availability' && sortDirection === 'asc' ? ' active' : ''}`}
                onClick={() => { setSortField('current.availability'); setSortDirection('asc'); }}
              >
                {t('analysis.sort.availability')} ▲
              </button>
            </div>
            <button className="secondary-button" type="button" onClick={() => setFitScreen((v) => !v)}>
              {fitScreen ? t('analysis.compact') : t('analysis.fullWidth')}
            </button>
            <TableWrapToggle wrapText={wrapText} onToggle={setWrapText} />
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="empty-state">{t('analysis.serviceSearch.empty', { search: searchInput })}</div>
        ) : (
          <div className={`table-wrap-shell ${wrapText ? 'table-wrap-enabled' : 'table-wrap-disabled'}`} style={{ overflowX: fitScreen ? 'auto' : 'visible' }}>
            <table className="data-table">
            <thead>
              <tr>
                <ResizableTh rowSpan={2} style={{ minWidth: 400 }} aria-sort={sortField === 'service' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  {sortControl(t('analysis.col.service'), 'service')}
                </ResizableTh>
                {metricColumns.map((column) => (
                  <th key={column.key} colSpan={3} className="metric-group-start">{column.title}</th>
                ))}
              </tr>
              <tr>
                {metricColumns.flatMap((column) => [
                  <ResizableTh key={`${column.key}-current`} className="metric-group-start" aria-sort={sortField === `current.${column.key}` ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {sortControl(t('analysis.col.current'), `current.${column.key}` as SortField)}
                  </ResizableTh>,
                  <ResizableTh key={`${column.key}-ref1d`} aria-sort={sortField === `ref1d.${column.key}` ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {sortControl(t('analysis.col.ref1d'), `ref1d.${column.key}` as SortField)}
                  </ResizableTh>,
                  <ResizableTh key={`${column.key}-ref7d`} aria-sort={sortField === `ref7d.${column.key}` ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {sortControl(t('analysis.col.ref7d'), `ref7d.${column.key}` as SortField)}
                  </ResizableTh>,
                ])}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.key}>
                  <td>
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
                  </td>
                  {metricColumns.flatMap((column) => [
                    <td key={`${row.service}-${column.key}-current`} className="metric-group-start">{column.currentCell(column.getCurrent(row))}</td>,
                    <td key={`${row.service}-${column.key}-ref1d`}><ReferenceDeltaCell current={column.getCurrent(row)} reference={column.getRef1d(row)} goodDirection={column.goodDirection} formatValue={column.formatRef} /></td>,
                    <td key={`${row.service}-${column.key}-ref7d`}><ReferenceDeltaCell current={column.getCurrent(row)} reference={column.getRef7d(row)} goodDirection={column.goodDirection} formatValue={column.formatRef} /></td>,
                  ])}
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}

      </SectionCard>
    </div>
  );
}
