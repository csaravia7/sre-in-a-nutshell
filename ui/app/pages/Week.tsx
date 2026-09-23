import React, { useMemo, useState } from 'react';
import { useDql } from '@dynatrace-sdk/react-hooks';
import { SectionCard } from '../components/SectionCard';
import { TableWrapToggle } from '../components/TableWrapToggle';
import { ResizableTh } from '../components/ResizableTh';
import { useTranslation } from '../i18n/LanguageProvider';
import type { Locale } from '../i18n/translations';
import { serviceAvailabilityQuery } from '../queries/week';
type ServiceAvailabilityRecord = {
  name: string;
  availability_pct: number;
  total_count: number;
  failure_count: number;
};

function getWeekRange(locale: Locale): string {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((day + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

function ServiceAvailabilitySection() {
  const { t } = useTranslation();
  const [wrapText, setWrapText] = useState(true);

  const query = serviceAvailabilityQuery;

  const { data, isLoading, error } = useDql<ServiceAvailabilityRecord>(query);
  const records = useMemo(() => data?.records ?? [], [data]);

  return (
    <SectionCard
      title={t('week.serviceAvailability.title')}
      isLoading={isLoading}
      error={error}
      isEmpty={records.length === 0}
      emptyMessage={t('week.serviceAvailability.empty')}
    >
      <div className={`table-wrap-shell ${wrapText ? 'table-wrap-enabled' : 'table-wrap-disabled'}`}>
        <div className="table-actions">
          <TableWrapToggle wrapText={wrapText} onToggle={setWrapText} />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <ResizableTh>{t('week.col.service')}</ResizableTh>
              <ResizableTh>{t('week.col.availability7d')}</ResizableTh>
              <ResizableTh>{t('week.col.requests')}</ResizableTh>
              <ResizableTh>{t('week.col.failures')}</ResizableTh>
            </tr>
          </thead>
          <tbody>
            {records.map((row) => {
              const pct = typeof row.availability_pct === 'number' ? row.availability_pct.toFixed(2) : '—';
              const color = row.availability_pct >= 99.9 ? 'green' : row.availability_pct >= 99 ? 'orange' : 'red';
              return (
                <tr key={`${row.name}-${row.total_count}`}>
                  <td>{row.name}</td>
                  <td style={{ color }}>{pct}%</td>
                  <td>{row.total_count}</td>
                  <td>{row.failure_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function PlaceholderSection({ title, message }: { title: string; message: string }) {
  return (
    <SectionCard
      title={title}
      isLoading={false}
      error={undefined}
      isEmpty={false}
      emptyMessage=""
    >
      <div className="empty-state">{message}</div>
    </SectionCard>
  );
}

export function Week() {
  const { t, locale } = useTranslation();
  return (
    <div className="page">
      <h2>{t('week.titleRange', { range: getWeekRange(locale) })}</h2>

      <PlaceholderSection title={t('week.alertNoise.title')} message={t('week.alertNoise.desc')} />
      <PlaceholderSection title={t('week.onCallLoad.title')} message={t('week.onCallLoad.desc')} />
      <PlaceholderSection title={t('week.repeatIncidents.title')} message={t('week.repeatIncidents.desc')} />
      <ServiceAvailabilitySection />
      <PlaceholderSection title={t('week.coverageDrift.title')} message={t('week.coverageDrift.desc')} />
      <PlaceholderSection title={t('week.capacityTrend.title')} message={t('week.capacityTrend.desc')} />
    </div>
  );
}
