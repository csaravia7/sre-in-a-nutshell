import React, { useMemo, useState } from 'react';
import { useDql } from '@dynatrace-sdk/react-hooks';
import { SectionCard } from '../../components/SectionCard';
import { useTranslation } from '../../i18n/LanguageProvider';
import {
  availabilityFormat,
  availabilityStatus,
  buildNamespaceQuery,
  errorRateFormat,
  latencyFormat,
  statusAccentColor,
  throughputFormat,
  toKpis,
  type MetricRecord,
} from './shared';

const CARD_PERIOD = ['now()-24h', 'now()'] as const;
const PAGE_SIZE = 15;

type SortField = 'availability_pct' | 'error_rate_pct' | 'total_count' | 'avg_response_time';
type SortState = { field: SortField; dir: 'asc' | 'desc' } | null;

const SORT_FIELDS: { field: SortField; labelKey: 'analysis.sort.availability' | 'analysis.sort.errorRate' | 'analysis.sort.throughput' | 'analysis.sort.latency'; descBest: boolean }[] = [
  { field: 'availability_pct',  labelKey: 'analysis.sort.availability', descBest: true },
  { field: 'error_rate_pct',    labelKey: 'analysis.sort.errorRate',    descBest: false },
  { field: 'total_count',       labelKey: 'analysis.sort.throughput',   descBest: true },
  { field: 'avg_response_time', labelKey: 'analysis.sort.latency',      descBest: false },
];

type NamespaceCardsSectionProps = {
  onSelect: (namespace: string) => void;
};

function StatBlock({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="stat-item">
      <span className="metric-label">{label}</span>
      <strong className="stat-value" style={{ color: color ?? 'var(--text)' }}>{value}</strong>
    </div>
  );
}

export function NamespaceCardsSection({ onSelect }: NamespaceCardsSectionProps) {
  const { t, locale } = useTranslation();
  const query = useMemo(() => buildNamespaceQuery(CARD_PERIOD), []);
  const { data, isLoading, error } = useDql<MetricRecord>(query);

  const records = useMemo(() => data?.records ?? [], [data]);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [sortState, setSortState] = useState<SortState>(null);

  const cycleSort = (field: SortField) => {
    setSortState((prev) => {
      if (prev === null || prev.field !== field) return { field, dir: 'desc' };
      if (prev.dir === 'desc') return { field, dir: 'asc' };
      return null;
    });
    setPage(0);
  };

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchInput.trim().toLocaleLowerCase(locale);
    const base = normalizedSearch.length === 0
      ? records
      : records.filter((r) => r.name.toLocaleLowerCase(locale).includes(normalizedSearch));
    if (sortState === null) return base;
    const { field, dir } = sortState;
    return [...base].sort((a, b) => {
      const av = parseFloat(String(a[field] ?? 0));
      const bv = parseFloat(String(b[field] ?? 0));
      if (isNaN(av) && isNaN(bv)) return 0;
      if (isNaN(av)) return 1;
      if (isNaN(bv)) return -1;
      return dir === 'desc' ? bv - av : av - bv;
    });
  }, [locale, records, searchInput, sortState]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRecords = filteredRecords.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <SectionCard
      title={t('analysis.cards.title')}
      isLoading={isLoading}
      error={error}
      isEmpty={records.length === 0}
      emptyMessage={t('analysis.empty')}
    >
      <div className="card-stack">
        <div className="filter-bar">
          <div className="analysis-search">
            <label htmlFor="namespace-search-input">{t('analysis.search.label')}</label>
            <div className="analysis-search-controls">
              <input
                id="namespace-search-input"
                type="search"
                value={searchInput}
                placeholder={t('analysis.search.placeholder')}
                onChange={(event) => { setSearchInput(event.target.value); setPage(0); }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
              {t('analysis.sort.label')}
            </label>
            <div className="sort-quick-group" role="group" aria-label={t('analysis.sort.label')}>
              {SORT_FIELDS.map(({ field, labelKey, descBest }) => {
                const active = sortState?.field === field ? sortState.dir : null;
                const indicator = active === 'desc' ? ' ▼' : active === 'asc' ? ' ▲' : '';
                const title = active === null
                  ? `${t(labelKey)}: ${descBest ? 'highest' : 'lowest'} first`
                  : active === 'desc'
                    ? `${t(labelKey)}: ${descBest ? 'lowest' : 'highest'} first`
                    : `${t(labelKey)}: clear sort`;
                return (
                  <button
                    key={field}
                    type="button"
                    className={`sort-quick-btn${active !== null ? ' active' : ''}`}
                    onClick={() => cycleSort(field)}
                    title={title}
                  >
                    {t(labelKey)}{indicator}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="empty-state">{t('analysis.search.empty', { search: searchInput })}</div>
        ) : (
          <div className="namespace-grid">
            {pageRecords.map((record) => {
            const kpis = toKpis(record);
            const availability = availabilityFormat(kpis.availability);
            const errorRate = errorRateFormat(kpis.errorRate);
            const throughput = throughputFormat(kpis.throughput, locale);
            const latency = latencyFormat(kpis.latency);
            const status = availabilityStatus(kpis.availability);

            return (
              <button
                type="button"
                key={record.name}
                className="namespace-card"
                aria-label={record.name}
                onClick={() => onSelect(record.name)}
                style={{ border: `1.5px solid ${statusAccentColor(status)}` }}
              >
                <div className="namespace-card-body">
                  <div className="namespace-card-header">
                    <div className="namespace-title">
                      <span className="status-dot" style={{ background: statusAccentColor(status) }} />
                      <span>{record.name}</span>
                    </div>
                    {record.service_count != null && (
                      <span className="namespace-service-badge">{t('analysis.serviceCountCard', { count: record.service_count })}</span>
                    )}
                  </div>

                  <div className="namespace-card-metrics">
                    <div className="primary-stat">
                      <span className="metric-label">{t('analysis.kpi.availability')}</span>
                      <strong className="primary-stat-value" style={{ color: availability.color }}>{availability.text}</strong>
                    </div>

                    <div className="stat-grid">
                      <StatBlock label={t('analysis.kpi.errorRate')} value={errorRate.text} color={errorRate.color} />
                      <StatBlock label={t('analysis.kpi.throughput')} value={throughput.text} color={throughput.color} />
                      <StatBlock label={t('analysis.kpi.latency')} value={latency.text} color={latency.color} />
                    </div>
                  </div>
                </div>
              </button>
            );
            })}
          </div>
        )}

        {filteredRecords.length > 0 && totalPages > 1 && (
          <div className="toolbar-row" style={{ justifyContent: 'flex-end' }}>
            <button className="secondary-button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              {t('analysis.pagination.prev')}
            </button>
            <span>{t('analysis.pagination.page', { page: safePage + 1, total: totalPages })}</span>
            <button className="secondary-button" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
              {t('analysis.pagination.next')}
            </button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
