import React, { useState } from 'react';
import { useUserState } from '../hooks/useUserState';
import { ProblemsSection } from '../sections/today/ProblemsSection';
import { ChangeEventsSection } from '../sections/today/ChangeEventsSection';
import { useTranslation } from '../i18n/LanguageProvider';
import type { Locale } from '../i18n/translations';

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Today() {
  const { state, isLoading, markAllReviewed, acknowledgeItem } = useUserState();
  const { t, locale } = useTranslation();
  const [isMarkingReviewed, setIsMarkingReviewed] = useState(false);

  function handleMarkAllReviewed() {
    setIsMarkingReviewed(true);
    void markAllReviewed().finally(() => {
      setIsMarkingReviewed(false);
    });
  }

  if (isLoading) {
    return null;
  }

  return (
    <div className="page">
      <div className="card-stack">
        <h2>{t('today.title')}</h2>
      </div>

      <p>
        {t('today.reviewingSince', { date: formatDate(state.lastSeen, locale) })}
        {state.isFirstVisit && t('today.firstVisit')}
      </p>

      <ProblemsSection
        lastSeen={state.lastSeen}
        acked={state.acked}
        onAck={(id) => { void acknowledgeItem(id); }}
      />

      <ChangeEventsSection lastSeen={state.lastSeen} />

      <div className="section-card">
        <div className="section-header">
          <h3 className="section-title">{t('today.saturation.title')}</h3>
        </div>
        <div className="section-body">
          <p>{t('today.saturation.desc')}</p>
        </div>
      </div>

      <div className="section-card">
        <div className="section-header">
          <h3 className="section-title">{t('today.silentSources.title')}</h3>
        </div>
        <div className="section-body">
          <p>{t('today.silentSources.desc')}</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="primary-button" onClick={handleMarkAllReviewed} disabled={isMarkingReviewed}>
          {isMarkingReviewed ? t('today.marking') : t('today.markAllReviewed')}
        </button>
      </div>
    </div>
  );
}
