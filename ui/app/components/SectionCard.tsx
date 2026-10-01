import React from 'react';
import { Skeleton, SkeletonText } from '@dynatrace/strato-components/content';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { useTranslation } from '../i18n/LanguageProvider';

type SectionCardProps = {
  title: string;
  /** True on the very first fetch (no prior data). Shows skeleton. */
  isLoading: boolean;
  /** True when re-fetching with existing content visible. Shows ProgressCircle next to the title. */
  reloading?: boolean;
  error: Error | undefined | null;
  isEmpty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
};

function SkeletonBody() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
      <SkeletonText lines={1} width="40%" />
      <Skeleton height="44px" />
      <SkeletonText lines={3} />
      <Skeleton height="180px" />
      <SkeletonText lines={2} width="60%" />
    </div>
  );
}

export function SectionCard({
  title,
  isLoading,
  reloading = false,
  error,
  isEmpty,
  emptyMessage,
  children,
}: SectionCardProps) {
  const { t } = useTranslation();

  function renderBody() {
    // First-ever fetch: hide content, show skeleton placeholder
    if (isLoading && !reloading) {
      return <SkeletonBody />;
    }

    if (error) {
      const message = error.message ?? String(error);
      const isPermission = message.includes('403');
      return (
        <div className="error-state">
          <strong>{isPermission ? t('error.permission.title') : t('error.generic.title')}</strong>
          <div>{isPermission ? t('error.permission.desc') : message}</div>
        </div>
      );
    }

    if (isEmpty && !reloading) {
      return <div className="empty-state">{emptyMessage}</div>;
    }

    return <>{children}</>;
  }

  return (
    <section className="section-card">
      <div className="section-header">
        <h3 className="section-title">{title}</h3>
        {/* Progressive loading indicator: visible only during re-fetches */}
        {reloading && (
          <ProgressCircle
            value="indeterminate"
            size="small"
            aria-label={t('common.loading')}
          />
        )}
      </div>
      <div className="section-body">{renderBody()}</div>
    </section>
  );
}
