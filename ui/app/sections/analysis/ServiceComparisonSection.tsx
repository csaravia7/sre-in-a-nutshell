import React, { useMemo, useState } from 'react';
import { useDql } from '@dynatrace-sdk/react-hooks';
import { getEnvironmentUrl } from '@dynatrace-sdk/app-environment';
import { SectionCard } from '../../components/SectionCard';
import { TableWrapToggle } from '../../components/TableWrapToggle';
import { ResizableTh } from '../../components/ResizableTh';
import { useTranslation } from '../../i18n/LanguageProvider';
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

// Current 24h vs the same 24h window one day ago and one week ago.
const TIMEFRAMES = {
  current: ['now()-24h', 'now()'],
  previousDay: ['now()-48h', 'now()-24h'],
  previousWeek: ['now()-8d', 'now()-7d'],
  lastSevenDays: ['now()-7d', 'now()'],
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

type ServiceComparisonSectionProps = {
  namespace: string;
  onBack: () => void;
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

export function ServiceComparisonSection({ namespace, onBack }: ServiceComparisonSectionProps) {
  const { t, locale } = useTranslation();
  const [fitScreen, setFitScreen] = useState(true);
  const [wrapText, setWrapText] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [sortField, setSortField] = useState<SortField>('current.throughput');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [availMin, setAvailMin] = useState(0);
  const [availMax, setAvailMax] = useState(100);

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
      for (const record of records ?? []) map.set(recordKey(record), record);
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
  }, [current.data, previousDay.data, previousWeek.data]);

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
    return rows.filter((row) => row.service.toLocaleLowerCase(locale).includes(normalizedSearch));
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

  function changeSort(nextField: SortField) {
    if (nextField === sortField) {
      setSortDirection((currentDirection) => currentDirection === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortField(nextField);
    setSortDirection(nextField === 'service' ? 'asc' : 'desc');
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
      <div className="toolbar-row namespace-detail-topbar">
        <div className="namespace-detail-breadcrumb">
          <button className="namespace-back-link" onClick={onBack}>{t('analysis.back')}</button>
          <span className="namespace-breadcrumb-sep" aria-hidden="true">›</span>
          <span className="namespace-breadcrumb-name">{namespace}</span>
        </div>
        <div className="toolbar-row" style={{ gap: 8 }}>
          <div className="sort-quick-group" role="group" aria-label={t('analysis.sort.label')}>
            <button
              type="button"
              className={`sort-quick-btn${sortField === 'current.availability' && sortDirection === 'desc' ? ' active' : ''}`}
              onClick={() => { setSortField('current.availability'); setSortDirection('desc'); }}
              title={t('analysis.sort.bestFirst')}
            >
              {t('analysis.sort.availDesc')}
            </button>
            <button
              type="button"
              className={`sort-quick-btn${sortField === 'current.availability' && sortDirection === 'asc' ? ' active' : ''}`}
              onClick={() => { setSortField('current.availability'); setSortDirection('asc'); }}
              title={t('analysis.sort.worstFirst')}
            >
              {t('analysis.sort.availAsc')}
            </button>
          </div>
          <button className="secondary-button" type="button" onClick={() => setFitScreen((v) => !v)}>
            {fitScreen ? t('analysis.compact') : t('analysis.fullWidth')}
          </button>
          <TableWrapToggle wrapText={wrapText} onToggle={setWrapText} />
        </div>
      </div>

      <SectionCard
        title={t('analysis.services.title', { namespace })}
        isLoading={isLoading}
        error={error}
        isEmpty={rows.length === 0}
        emptyMessage={t('analysis.services.empty')}
      >
        <div className="filter-bar">
          <div className="analysis-search">
            <label htmlFor="service-search-input">{t('analysis.serviceSearch.label')}</label>
            <div className="analysis-search-controls">
              <input
                id="service-search-input"
                type="search"
                value={searchInput}
                placeholder={t('analysis.serviceSearch.placeholder')}
                onChange={(event) => setSearchInput(event.target.value)}
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
                  onChange={(e) => setAvailMin(Math.min(parseFloat(e.target.value), availMax - 0.1))}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={availMax}
                  style={{ zIndex: 2 }}
                  onChange={(e) => setAvailMax(Math.max(parseFloat(e.target.value), availMin + 0.1))}
                />
              </div>
              <div className="dual-range-ticks">
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>
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
              {rangeFilteredRows.map((row) => (
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
