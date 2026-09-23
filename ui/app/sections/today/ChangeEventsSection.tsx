import React, { useMemo, useState } from 'react';
import { useDql } from '@dynatrace-sdk/react-hooks';
import { SectionCard } from '../../components/SectionCard';
import { ActionPill } from '../../components/ActionPill';
import { TableWrapToggle } from '../../components/TableWrapToggle';
import { ResizableTh } from '../../components/ResizableTh';
import { useTranslation } from '../../i18n/LanguageProvider';
import type { MessageKey } from '../../i18n/translations';
import { changeEventsQuery } from '../../queries/today';

type ChangeEventRecord = {
  'event.start': string;
  'event.name': string;
  'dt.entity.service': string;
  'deployment.name': string;
};

type FlatChangeEvent = {
  name: string;
  service: string;
  timeAgo: string;
};

type TranslateFn = (key: MessageKey, params?: Record<string, string | number>) => string;

function timeAgo(dateStr: string, t: TranslateFn): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return t('time.minutesAgo', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { n: hours });
  return t('time.daysAgo', { n: Math.floor(hours / 24) });
}

type ChangeEventsSectionProps = {
  lastSeen: string;
};

export function ChangeEventsSection({ lastSeen }: ChangeEventsSectionProps) {
  const { t } = useTranslation();
  const [wrapText, setWrapText] = useState(true);
  const query = changeEventsQuery(lastSeen);

  const { data, isLoading, error } = useDql<ChangeEventRecord>(query);
  const records = useMemo(() => data?.records ?? [], [data]);

  const flatEvents = useMemo<FlatChangeEvent[]>(
    () =>
      records.map((r) => ({
        name: r['deployment.name'] || r['event.name'] || t('changeEvents.unnamed'),
        service: r['dt.entity.service'] || '—',
        timeAgo: timeAgo(r['event.start'], t),
      })),
    [records, t]
  );

  return (
    <SectionCard
      title={t('changeEvents.title')}
      isLoading={isLoading}
      error={error}
      isEmpty={flatEvents.length === 0}
      emptyMessage={t('changeEvents.empty')}
    >
      <div className={`table-wrap-shell ${wrapText ? 'table-wrap-enabled' : 'table-wrap-disabled'}`}>
        <div className="table-actions">
          <TableWrapToggle wrapText={wrapText} onToggle={setWrapText} />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <ResizableTh></ResizableTh>
              <ResizableTh>{t('changeEvents.col.deployment')}</ResizableTh>
              <ResizableTh>{t('changeEvents.col.service')}</ResizableTh>
              <ResizableTh>{t('changeEvents.col.when')}</ResizableTh>
            </tr>
          </thead>
          <tbody>
            {flatEvents.map((row) => (
              <tr key={`${row.name}-${row.service}-${row.timeAgo}`}>
                <td><ActionPill type="context" /></td>
                <td>{row.name}</td>
                <td>{row.service}</td>
                <td>{row.timeAgo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
