import React, { useMemo, useState } from 'react';
import { useDql } from '@dynatrace-sdk/react-hooks';
import { SectionCard } from '../../components/SectionCard';
import { ActionPill } from '../../components/ActionPill';
import { TableWrapToggle } from '../../components/TableWrapToggle';
import { ResizableTh } from '../../components/ResizableTh';
import { useTranslation } from '../../i18n/LanguageProvider';
import type { MessageKey } from '../../i18n/translations';
import { problemsQuery } from '../../queries/today';

type ProblemRecord = {
  display_id: string;
  'event.name': string;
  'event.status': string;
  'event.start': string;
  'event.end': string;
  'event.category': string;
};

type FlatProblem = {
  display_id: string;
  name: string;
  groupKey: MessageKey;
  groupOrder: number;
  duration: string;
  isAcked: boolean;
};

function formatDuration(startStr: string, endStr: string | null): string {
  const start = new Date(startStr).getTime();
  const end = endStr ? new Date(endStr).getTime() : Date.now();
  const minutes = Math.floor((end - start) / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

type ProblemsSectionProps = {
  lastSeen: string;
  acked: string[];
  onAck: (id: string) => void;
};

export function ProblemsSection({ lastSeen, acked, onAck }: ProblemsSectionProps) {
  const { t } = useTranslation();
  const [wrapText, setWrapText] = useState(true);
  const query = problemsQuery(lastSeen);

  const { data, isLoading, error } = useDql<ProblemRecord>(query);
  const records = useMemo(() => data?.records ?? [], [data]);
  const limitReached = records.length === 200;

  const lastSeenTime = new Date(lastSeen).getTime();

  const flatProblems = useMemo<FlatProblem[]>(() => {
    return records
      .map((r) => {
        const isOpen = r['event.status'] === 'OPEN';
        const startedAfterLastSeen = new Date(r['event.start']).getTime() >= lastSeenTime;
        let groupKey: MessageKey;
        let groupOrder: number;
        if (isOpen && !startedAfterLastSeen) {
          groupKey = 'problems.group.stillOpen';
          groupOrder = 0;
        } else if (isOpen && startedAfterLastSeen) {
          groupKey = 'problems.group.openedSinceLastVisit';
          groupOrder = 1;
        } else {
          groupKey = 'problems.group.resolved';
          groupOrder = 2;
        }
        return {
          display_id: r.display_id,
          name: r['event.name'] || r.display_id,
          groupKey,
          groupOrder,
          duration: formatDuration(r['event.start'], isOpen ? null : r['event.end']),
          isAcked: acked.includes(r.display_id),
        };
      })
      .sort((a, b) => a.groupOrder - b.groupOrder);
  }, [records, acked, lastSeenTime]);

  return (
    <SectionCard
      title={`${t('problems.title')}${limitReached ? t('problems.showingFirst200') : ''}`}
      isLoading={isLoading}
      error={error}
      isEmpty={flatProblems.length === 0}
      emptyMessage={t('problems.empty')}
    >
      <div className={`table-wrap-shell ${wrapText ? 'table-wrap-enabled' : 'table-wrap-disabled'}`}>
        <div className="table-actions">
          <TableWrapToggle wrapText={wrapText} onToggle={setWrapText} />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <ResizableTh></ResizableTh>
              <ResizableTh>{t('problems.col.problem')}</ResizableTh>
              <ResizableTh>{t('problems.col.status')}</ResizableTh>
              <ResizableTh>{t('problems.col.duration')}</ResizableTh>
              <ResizableTh></ResizableTh>
            </tr>
          </thead>
          <tbody>
            {flatProblems.map((row) => (
              <tr key={row.display_id}>
                <td>{row.groupOrder !== 2 ? <ActionPill type="act-now" /> : null}</td>
                <td>{row.name}</td>
                <td>{t(row.groupKey)}</td>
                <td>{row.duration}</td>
                <td>
                  <button
                    type="button"
                    className={`tag-button ${row.isAcked ? 'acked' : 'pending'}`}
                    onClick={() => onAck(row.display_id)}
                  >
                    {row.isAcked ? t('problems.acked') : t('problems.ack')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
